import { createHmac, randomUUID } from 'node:crypto';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { FlagValueType } from '@/apps/control-api/domain/flag';
import { Role } from '@/apps/control-api/domain/user';
import { InMemoryRuntimeSnapshotProvider } from '@/apps/decide-api/infrastructure/runtime-snapshot.provider';
import { InMemoryEventTypeCatalogProvider } from '@/apps/ingest-api/infrastructure/event-type-catalog.provider';
import type { E2EContext } from './bootstrap';

type HttpClient = E2EContext['http'];
const PROJECTION_WAIT_TIMEOUT_MS = 15000;
const PROJECTION_WAIT_STEP_MS = 100;
const TEST_AUTH_TTL_SECONDS = 3600;
let cachedBootstrapAdminToken: string | null = null;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
interface RuntimeVariantState {
  id: string;
  name: string;
  value: string;
  weight: number;
  isControl: boolean;
}
interface RuntimeExperimentState {
  id: string;
  flagId: string;
  status: ExperimentStatus;
  conflictDomain: string | null;
  priority: number;
  audiencePercent: number;
  targetingRule: unknown;
  variants: RuntimeVariantState[];
  completion: {
    outcomeType: string | null;
    winnerVariantId: string | null;
    comment: string | null;
    decidedById: string | null;
  } | null;
}
function encodeBase64Url(input: string | Buffer): string {
  const base64 = Buffer.isBuffer(input)
    ? input.toString('base64')
    : Buffer.from(input).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function signHmac(payload: string, secret: Buffer): string {
  return encodeBase64Url(createHmac('sha256', secret).update(payload).digest());
}
function deriveAuthSigningSecret(appSecret: string): Buffer {
  return createHmac('sha256', Buffer.from(appSecret, 'utf8')).update('auth-token-v1').digest();
}
function createAccessTokenForUser(userId: string): string {
  const appSecret = process.env.APP_SECRET ?? 'e2e-app-secret';
  const secret = deriveAuthSigningSecret(appSecret);
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + TEST_AUTH_TTL_SECONDS,
    jti: randomUUID(),
  };
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = signHmac(signingInput, secret);
  return `${signingInput}.${signature}`;
}
export function authHeaderForUser(userId: string): string {
  return `Bearer ${createAccessTokenForUser(userId)}`;
}
export function resetFactoryCaches(): void {
  cachedBootstrapAdminToken = null;
}
async function loginBootstrapAdmin(http: HttpClient): Promise<string> {
  if (cachedBootstrapAdminToken) {
    return cachedBootstrapAdminToken;
  }
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'SecurePass123';
  const response = await http.post('/auth/login').send({ email, password });
  if (response.status !== 200 || typeof response.body.accessToken !== 'string') {
    throw new Error(
      `bootstrap admin login failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  cachedBootstrapAdminToken = response.body.accessToken as string;
  return cachedBootstrapAdminToken;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function parseVariant(input: unknown): RuntimeVariantState | null {
  if (!isRecord(input)) return null;
  if (typeof input.id !== 'string') return null;
  if (typeof input.name !== 'string') return null;
  if (typeof input.value !== 'string') return null;
  if (typeof input.weight !== 'number') return null;
  if (typeof input.isControl !== 'boolean') return null;
  return {
    id: input.id,
    name: input.name,
    value: input.value,
    weight: input.weight,
    isControl: input.isControl,
  };
}
function deriveStatusFromEventType(
  current: ExperimentStatus | null,
  eventType: string,
): ExperimentStatus | null {
  switch (eventType) {
    case 'ExperimentCreated':
      return ExperimentStatus.DRAFT;
    case 'ExperimentSubmittedForReview':
      return ExperimentStatus.IN_REVIEW;
    case 'ExperimentApproved':
      return ExperimentStatus.APPROVED;
    case 'ExperimentRejected':
      return ExperimentStatus.REJECTED;
    case 'ExperimentChangesRequested':
    case 'ExperimentRevised':
      return ExperimentStatus.DRAFT;
    case 'ExperimentStarted':
      return ExperimentStatus.RUNNING;
    case 'ExperimentPaused':
      return ExperimentStatus.PAUSED;
    case 'ExperimentResumed':
      return ExperimentStatus.RUNNING;
    case 'ExperimentCompleted':
      return ExperimentStatus.COMPLETED;
    case 'ExperimentArchived':
      return ExperimentStatus.ARCHIVED;
    default:
      return current;
  }
}
export async function getExperimentRuntimeState(
  context: E2EContext,
  experimentId: string,
): Promise<RuntimeExperimentState | null> {
  const events = await context.prisma.experimentEvent.findMany({
    where: { aggregateId: experimentId },
    orderBy: { version: 'asc' },
    select: { eventType: true, payload: true },
  });
  if (events.length === 0) {
    return null;
  }
  let state: RuntimeExperimentState | null = null;
  for (const event of events) {
    const nextStatus = deriveStatusFromEventType(state?.status ?? null, event.eventType);
    const payload = event.payload;
    if (event.eventType === 'ExperimentCreated') {
      if (!isRecord(payload)) continue;
      if (typeof payload.flagId !== 'string') continue;
      const createdVariants = Array.isArray(payload.variants)
        ? payload.variants
            .map((variant) => parseVariant(variant))
            .filter((variant): variant is RuntimeVariantState => variant !== null)
        : [];
      state = {
        id: experimentId,
        flagId: payload.flagId,
        status: nextStatus ?? ExperimentStatus.DRAFT,
        conflictDomain: typeof payload.conflictDomain === 'string' ? payload.conflictDomain : null,
        priority: typeof payload.priority === 'number' ? payload.priority : 0,
        audiencePercent:
          typeof payload.audiencePercent === 'number' ? payload.audiencePercent : 100,
        targetingRule: payload.targetingRule ?? null,
        variants: createdVariants,
        completion: null,
      };
      continue;
    }
    if (!state) continue;
    state.status = nextStatus ?? state.status;
    if (event.eventType === 'ExperimentAudiencePercentChanged' && isRecord(payload)) {
      if (typeof payload.audiencePercent === 'number') {
        state.audiencePercent = payload.audiencePercent;
      }
      continue;
    }
    if (event.eventType === 'ExperimentTargetingRuleChanged' && isRecord(payload)) {
      state.targetingRule = payload.targetingRule ?? null;
      continue;
    }
    if (event.eventType === 'VariantAdded' && isRecord(payload)) {
      const variant = parseVariant(payload.variant);
      if (variant) {
        state.variants = [...state.variants, variant];
      }
      continue;
    }
    if (event.eventType === 'VariantUpdated' && isRecord(payload)) {
      if (typeof payload.variantId !== 'string') continue;
      state.variants = state.variants.map((variant) => {
        if (variant.id !== payload.variantId) return variant;
        return {
          id: variant.id,
          name: typeof payload.name === 'string' ? payload.name : variant.name,
          value: typeof payload.value === 'string' ? payload.value : variant.value,
          weight: typeof payload.weight === 'number' ? payload.weight : variant.weight,
          isControl: typeof payload.isControl === 'boolean' ? payload.isControl : variant.isControl,
        };
      });
      continue;
    }
    if (event.eventType === 'VariantRemoved' && isRecord(payload)) {
      if (typeof payload.variantId !== 'string') continue;
      state.variants = state.variants.filter((variant) => variant.id !== payload.variantId);
      continue;
    }
    if (event.eventType === 'ExperimentCompleted' && isRecord(payload)) {
      state.completion = {
        outcomeType: typeof payload.outcomeType === 'string' ? payload.outcomeType : null,
        winnerVariantId:
          typeof payload.winnerVariantId === 'string' ? payload.winnerVariantId : null,
        comment: typeof payload.comment === 'string' ? payload.comment : null,
        decidedById: typeof payload.decidedById === 'string' ? payload.decidedById : null,
      };
    }
  }
  return state;
}
export async function materializeExperimentProjectionForFk(
  context: E2EContext,
  experimentId: string,
): Promise<void> {
  const createdEvent = await context.prisma.experimentEvent.findFirst({
    where: {
      aggregateId: experimentId,
      eventType: 'ExperimentCreated',
    },
    orderBy: { version: 'asc' },
    select: { payload: true },
  });
  if (!createdEvent || !isRecord(createdEvent.payload)) {
    throw new Error(
      `materializeExperimentProjectionForFk failed: ExperimentCreated event not found for ${experimentId}`,
    );
  }
  const payload = createdEvent.payload;
  if (
    typeof payload.name !== 'string' ||
    typeof payload.flagId !== 'string' ||
    typeof payload.ownerId !== 'string' ||
    typeof payload.audiencePercent !== 'number'
  ) {
    throw new Error(
      `materializeExperimentProjectionForFk failed: malformed ExperimentCreated payload for ${experimentId}`,
    );
  }
  const name = payload.name;
  const flagId = payload.flagId;
  const ownerId = payload.ownerId;
  const audiencePercent = payload.audiencePercent;
  const description = typeof payload.description === 'string' ? payload.description : null;
  const conflictDomain = typeof payload.conflictDomain === 'string' ? payload.conflictDomain : null;
  const priority = typeof payload.priority === 'number' ? payload.priority : 0;
  const variants = Array.isArray(payload.variants)
    ? payload.variants
        .map((variant) => parseVariant(variant))
        .filter((variant): variant is RuntimeVariantState => variant !== null)
    : [];
  await context.prisma.$transaction(async (tx) => {
    await tx.experiment.upsert({
      where: { id: experimentId },
      create: {
        id: experimentId,
        name,
        description,
        flagId,
        ownerId,
        audiencePercent,
        conflictDomain,
        priority,
      },
      update: {
        name,
        description,
        flagId,
        ownerId,
        audiencePercent,
        conflictDomain,
        priority,
      },
    });
    if (variants.length === 0) {
      return;
    }
    const variantIds = variants.map((variant) => variant.id);
    await tx.variant.deleteMany({
      where: {
        experimentId,
        id: { notIn: variantIds },
      },
    });
    for (const variant of variants) {
      await tx.variant.upsert({
        where: { id: variant.id },
        create: {
          id: variant.id,
          experimentId,
          name: variant.name,
          value: variant.value,
          weight: variant.weight,
          isControl: variant.isControl,
        },
        update: {
          experimentId,
          name: variant.name,
          value: variant.value,
          weight: variant.weight,
          isControl: variant.isControl,
        },
      });
    }
  });
}
interface CreateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
}
interface CreateFlagInput {
  key?: string;
  valueType?: FlagValueType;
  defaultValue?: string;
  description?: string;
}
interface CreateExperimentInput {
  actorId: string;
  flagId: string;
  name?: string;
  description?: string;
  audiencePercent?: number;
  conflictDomain?: string | null;
  priority?: number;
  targetingRule?: unknown;
  variants?: Array<{
    name: string;
    value: string;
    weight: number;
    isControl: boolean;
  }>;
  metricIds?: string[];
  primaryMetricId?: string | null;
  autoAttachPrimaryMetric?: boolean;
}
interface CreateApproverGroupInput {
  ownerId: string;
  memberId: string;
  requiredApprovals?: number;
}
interface CreateMetricDefinitionInput {
  key?: string;
  name?: string;
  description?: string | null;
  formula: Record<string, unknown>;
}
interface CreateEventTypeInput {
  key?: string;
  name?: string;
  description?: string | null;
  schema?: Record<string, unknown> | null;
  requiresExposure?: boolean;
}
export async function createUser(http: HttpClient, input: CreateUserInput = {}): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const adminAccessToken = await loginBootstrapAdmin(http);
  const response = await http
    .post('/users')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({
      email: input.email ?? `user-${suffix}@example.com`,
      password: input.password ?? 'SecurePass123',
      name: input.name ?? `User ${suffix}`,
      role: input.role ?? Role.VIEWER,
    });
  if (response.status !== 201 || typeof response.body.id !== 'string') {
    throw new Error(`createUser failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.id as string;
}
export async function createFlag(http: HttpClient, input: CreateFlagInput = {}): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const key = input.key ?? `flag_${suffix}`;
  const defaultValue = input.defaultValue ?? 'A';
  const adminAccessToken = await loginBootstrapAdmin(http);
  const response = await http
    .post('/flags')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({
      key,
      valueType: input.valueType ?? FlagValueType.STRING,
      defaultValue,
      description: input.description ?? 'test flag',
    });
  if (response.status !== 201 || typeof response.body.id !== 'string') {
    throw new Error(`createFlag failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.id as string;
}
export async function createExperiment(
  http: HttpClient,
  input: CreateExperimentInput,
): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  let metricIds = input.metricIds;
  let primaryMetricId = input.primaryMetricId ?? null;
  if (input.autoAttachPrimaryMetric !== false && metricIds === undefined) {
    const metricId = await createMetricDefinition(http, {
      formula: {
        type: 'COUNT',
        eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.autometric`,
      },
      key: `metric_${crypto.randomUUID().slice(0, 8)}_autocreated`,
      name: `Auto metric ${crypto.randomUUID().slice(0, 6)}`,
    });
    metricIds = [metricId];
    primaryMetricId = metricId;
  }
  const response = await http
    .post('/experiments')
    .set('Authorization', authHeaderForUser(input.actorId))
    .send({
      name: input.name ?? `Experiment ${suffix}`,
      description: input.description ?? 'integration test experiment',
      flagId: input.flagId,
      conflictDomain: input.conflictDomain ?? null,
      priority: input.priority ?? 0,
      audiencePercent: input.audiencePercent ?? 100,
      targetingRule: input.targetingRule ?? null,
      variants: input.variants ?? [
        { name: 'Control', value: 'A', weight: 50, isControl: true },
        { name: 'Treatment', value: 'B', weight: 50, isControl: false },
      ],
      metricIds,
      primaryMetricId,
    });
  if (response.status !== 201 || typeof response.body.id !== 'string') {
    throw new Error(`createExperiment failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.id as string;
}
export async function createApproverGroupWithMember(
  http: HttpClient,
  input: CreateApproverGroupInput,
): Promise<string> {
  const adminAccessToken = await loginBootstrapAdmin(http);
  const createGroupResponse = await http
    .post('/approver-groups')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({
      ownerId: input.ownerId,
      requiredApprovals: input.requiredApprovals ?? 1,
    });
  if (createGroupResponse.status !== 201 || typeof createGroupResponse.body.id !== 'string') {
    throw new Error(
      `createApproverGroupWithMember create group failed: ${createGroupResponse.status} ${JSON.stringify(createGroupResponse.body)}`,
    );
  }
  const groupId = createGroupResponse.body.id as string;
  const addMemberResponse = await http
    .post(`/approver-groups/${groupId}/members`)
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ userId: input.memberId });
  if (addMemberResponse.status !== 201) {
    throw new Error(
      `createApproverGroupWithMember add member failed: ${addMemberResponse.status} ${JSON.stringify(addMemberResponse.body)}`,
    );
  }
  return groupId;
}
export async function createMetricDefinition(
  http: HttpClient,
  input: CreateMetricDefinitionInput,
): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const adminAccessToken = await loginBootstrapAdmin(http);
  const response = await http
    .post('/metric-definitions')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({
      key: input.key ?? `metric_${suffix}`,
      name: input.name ?? `Metric ${suffix}`,
      description: input.description ?? null,
      formula: input.formula,
    });
  if (response.status !== 201 || typeof response.body.id !== 'string') {
    throw new Error(
      `createMetricDefinition failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.id as string;
}
export async function createEventType(
  http: HttpClient,
  input: CreateEventTypeInput = {},
): Promise<{
  id: string;
  key: string;
}> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const key = input.key ?? `event.${suffix}.default`;
  const adminAccessToken = await loginBootstrapAdmin(http);
  const response = await http
    .post('/event-types')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({
      key,
      name: input.name ?? `Event ${suffix}`,
      description: input.description ?? null,
      schema: input.schema ?? null,
      requiresExposure: input.requiresExposure ?? false,
    });
  if (response.status !== 201 || typeof response.body.id !== 'string') {
    throw new Error(`createEventType failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { id: response.body.id as string, key };
}
export async function syncRuntimeSnapshotForFlag(
  context: E2EContext,
  flagId: string,
): Promise<void> {
  const snapshotProvider = context.app.get(InMemoryRuntimeSnapshotProvider, {
    strict: false,
  });
  const flag = await context.prisma.flag.findUnique({
    where: { id: flagId },
    select: {
      id: true,
      key: true,
      valueType: true,
      defaultValue: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!flag) {
    throw new Error(`syncRuntimeSnapshotForFlag failed: flag not found ${flagId}`);
  }
  const createdEvents = await context.prisma.experimentEvent.findMany({
    where: { eventType: 'ExperimentCreated' },
    select: {
      aggregateId: true,
      payload: true,
    },
  });
  const experimentIdsForFlag = createdEvents
    .filter(
      (event) =>
        isRecord(event.payload) &&
        typeof event.payload.flagId === 'string' &&
        event.payload.flagId === flagId,
    )
    .map((event) => event.aggregateId);
  const runtimeStates = await Promise.all(
    experimentIdsForFlag.map((experimentId) => getExperimentRuntimeState(context, experimentId)),
  );
  const activeExperiments = runtimeStates.filter(
    (state): state is RuntimeExperimentState =>
      state !== null &&
      (state.status === ExperimentStatus.RUNNING || state.status === ExperimentStatus.PAUSED),
  );
  const experiment = activeExperiments.length === 1 ? activeExperiments[0] : null;
  snapshotProvider.apply({
    flag: {
      id: flag.id,
      key: flag.key,
      valueType: flag.valueType,
      defaultValue: flag.defaultValue,
      description: flag.description,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt?.toISOString() ?? null,
    },
    experiment: experiment
      ? {
          id: experiment.id,
          flagId: experiment.flagId,
          status: experiment.status,
          conflictDomain: experiment.conflictDomain,
          priority: experiment.priority,
          audiencePercent: experiment.audiencePercent,
          targetingRule: experiment.targetingRule,
          variants: experiment.variants.map((variant) => ({
            id: variant.id,
            value: variant.value,
            weight: variant.weight,
            isControl: variant.isControl,
          })),
        }
      : null,
    generatedAt: new Date().toISOString(),
  });
}
export async function syncRuntimeSnapshotForExperiment(
  context: E2EContext,
  experimentId: string,
): Promise<void> {
  const experiment = await getExperimentRuntimeState(context, experimentId);
  if (!experiment) {
    throw new Error(
      `syncRuntimeSnapshotForExperiment failed: experiment not found ${experimentId}`,
    );
  }
  await syncRuntimeSnapshotForFlag(context, experiment.flagId);
}
export async function syncEventTypeCatalogById(
  context: E2EContext,
  eventTypeId: string,
): Promise<void> {
  const catalog = context.app.get(InMemoryEventTypeCatalogProvider, {
    strict: false,
  });
  const eventType = await context.prisma.eventType.findUnique({
    where: { id: eventTypeId },
    select: {
      id: true,
      key: true,
      schema: true,
      requiresExposure: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!eventType) {
    throw new Error(`syncEventTypeCatalogById failed: eventType not found ${eventTypeId}`);
  }
  catalog.apply({
    id: eventType.id,
    key: eventType.key,
    schema: eventType.schema,
    requiresExposure: eventType.requiresExposure,
    isArchived: eventType.isArchived,
    createdAt: eventType.createdAt.toISOString(),
    updatedAt: eventType.updatedAt?.toISOString() ?? null,
  });
}
export async function waitForExperimentStatus(
  context: E2EContext,
  experimentId: string,
  expectedStatus: ExperimentStatus,
  _actorId: string,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= PROJECTION_WAIT_TIMEOUT_MS) {
    const state = await getExperimentRuntimeState(context, experimentId);
    if (state?.status === expectedStatus) {
      return;
    }
    await sleep(PROJECTION_WAIT_STEP_MS);
  }
  throw new Error(
    `waitForExperimentStatus timed out for ${experimentId}; expected ${expectedStatus}`,
  );
}
