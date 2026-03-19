import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { Role } from '@/apps/control-api/domain/user';
import { NotificationDispatcher } from '@/apps/control-workers/notification/notification.dispatcher';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createExperiment,
  createFlag,
  createUser,
  materializeExperimentProjectionForFk,
  waitForExperimentStatus,
} from './factories';

vi.setConfig({ testTimeout: 30000 });
applyMigrations();
async function loginAsAdmin(context: E2EContext): Promise<string> {
  const response = await context.http.post('/auth/login').send({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'SecurePass123',
  });
  expect(response.status).toBe(200);
  expect(typeof response.body.accessToken).toBe('string');
  return response.body.accessToken as string;
}
async function createRunningExperiment(context: E2EContext): Promise<{
  ownerId: string;
  experimentId: string;
  flagKey: string;
}> {
  const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
  const approverId = await createUser(context.http, { role: Role.APPROVER });
  await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
  const flagKey = `notify_flag_${crypto.randomUUID().slice(0, 8)}`;
  const flagId = await createFlag(context.http, {
    key: flagKey,
    defaultValue: 'A',
  });
  const experimentId = await createExperiment(context.http, {
    actorId: ownerId,
    flagId,
    name: `Notification Experiment ${crypto.randomUUID().slice(0, 8)}`,
  });
  const submit = await context.http
    .post(`/experiments/${experimentId}/submit`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(submit.status).toBe(200);
  const approve = await context.http
    .post(`/experiments/${experimentId}/approve`)
    .set('Authorization', authHeaderForUser(approverId))
    .send({ comment: 'approved for notifications tests' });
  expect(approve.status).toBe(200);
  const start = await context.http
    .post(`/experiments/${experimentId}/start`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(start.status).toBe(200);
  await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);
  await materializeExperimentProjectionForFk(context, experimentId);
  return { ownerId, experimentId, flagKey };
}
function createGuardrailTriggeredEnvelope(experimentId: string, eventId: string) {
  return {
    aggregateType: 'Experiment',
    aggregateId: experimentId,
    eventName: 'GuardrailTriggered',
    eventId,
    occurredOn: new Date().toISOString(),
    version: 1,
    payload: {
      metricKey: 'errors.rate',
      metricKeys: ['errors.rate'],
      environment: 'prod',
      breaches: [
        {
          ruleId: crypto.randomUUID(),
          metricKey: 'errors.rate',
          metricValue: 3,
          threshold: 1,
          operator: 'GT',
          windowMinutes: 10,
        },
      ],
    },
  };
}
function createLifecycleEnvelope(
  experimentId: string,
  eventName:
    | 'ExperimentSubmittedForReview'
    | 'ExperimentApproved'
    | 'ExperimentRejected'
    | 'ExperimentStarted'
    | 'ExperimentPaused'
    | 'ExperimentResumed'
    | 'ExperimentCompleted',
) {
  return {
    aggregateType: 'Experiment',
    aggregateId: experimentId,
    eventName,
    eventId: crypto.randomUUID(),
    occurredOn: new Date().toISOString(),
    version: 1,
    payload: {},
  };
}
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
describe('notifications c7 e2e', () => {
  let context: E2EContext;
  const originalFetch = globalThis.fetch;
  beforeAll(async () => {
    context = await createE2EContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
    await resetE2ETestDoubles(context);
    globalThis.fetch = originalFetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (context) {
      await closeE2EContext(context);
    }
  });
  it('creates channel and rule, then records FAILED delivery when channel config is invalid', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Slack ${crypto.randomUUID().slice(0, 8)}`,
        type: 'SLACK',
        config: {},
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    expect(typeof channelId).toBe('string');
    const createRule = await context.http
      .post('/notifications/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Guardrail alerts ${crypto.randomUUID().slice(0, 8)}`,
        event: 'GuardrailTriggered',
        scopeType: 'EXPERIMENT',
        scopeValue: experimentId,
        metricKey: 'errors.rate',
        rateLimitCount: 5,
        rateLimitWindowSec: 300,
        dedupeWindowSec: 1,
        targets: [{ channelId }],
      });
    expect(createRule.status).toBe(201);
    const ruleId = createRule.body.id as string;
    expect(typeof ruleId).toBe('string');
    const dispatcher = context.app.get(NotificationDispatcher);
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    const deliveries = await context.http
      .get('/notifications/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ ruleId, status: 'FAILED', limit: 10, offset: 0 });
    expect(deliveries.status).toBe(200);
    expect(Array.isArray(deliveries.body.data)).toBe(true);
    expect(deliveries.body.data.length).toBe(1);
    const delivery = deliveries.body.data[0] as Record<string, unknown>;
    expect(delivery.ruleId).toBe(ruleId);
    expect(delivery.status).toBe('FAILED');
    expect(delivery.errorMessage).toBe('Slack webhook url is missing');
    expect((delivery.payload as Record<string, unknown>).eventName).toBe('GuardrailTriggered');
  });
  it('suppresses repeated notifications by rate limit after first successful send', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `SlackRL ${crypto.randomUUID().slice(0, 8)}`,
        type: 'SLACK',
        config: {
          webhookUrl: 'https://hooks.slack.test/services/test',
        },
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    const createRule = await context.http
      .post('/notifications/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Rate limit rule ${crypto.randomUUID().slice(0, 8)}`,
        event: 'GuardrailTriggered',
        scopeType: 'EXPERIMENT',
        scopeValue: experimentId,
        rateLimitCount: 1,
        rateLimitWindowSec: 3600,
        dedupeWindowSec: 1,
        targets: [{ channelId }],
      });
    expect(createRule.status).toBe(201);
    const ruleId = createRule.body.id as string;
    const dispatcher = context.app.get(NotificationDispatcher);
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    await sleep(1200);
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    expect(fetchCalls).toBe(1);
    const deliveries = await context.http
      .get('/notifications/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ ruleId, limit: 10, offset: 0 });
    expect(deliveries.status).toBe(200);
    expect(Array.isArray(deliveries.body.data)).toBe(true);
    expect(deliveries.body.data.length).toBe(2);
    const statuses = new Set<string>(
      (deliveries.body.data as Array<Record<string, unknown>>).map((item) => item.status as string),
    );
    expect(statuses.has('SENT')).toBe(true);
    expect(statuses.has('SUPPRESSED_RATE_LIMIT')).toBe(true);
  });
  it('dispatches notifications for rules regardless of optional payload fields', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `SlackSeverity ${crypto.randomUUID().slice(0, 8)}`,
        type: 'SLACK',
        config: {
          webhookUrl: 'https://hooks.slack.test/services/test',
        },
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    const criticalRule = await context.http
      .post('/notifications/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Critical rule ${crypto.randomUUID().slice(0, 8)}`,
        event: 'GuardrailTriggered',
        scopeType: 'EXPERIMENT',
        scopeValue: experimentId,
        environment: process.env.NODE_ENV ?? 'production',
        dedupeWindowSec: 1,
        targets: [{ channelId }],
      });
    expect(criticalRule.status).toBe(201);
    const criticalRuleId = criticalRule.body.id as string;
    const warningRule = await context.http
      .post('/notifications/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Warning rule ${crypto.randomUUID().slice(0, 8)}`,
        event: 'GuardrailTriggered',
        scopeType: 'EXPERIMENT',
        scopeValue: experimentId,
        environment: process.env.NODE_ENV ?? 'production',
        dedupeWindowSec: 1,
        targets: [{ channelId }],
      });
    expect(warningRule.status).toBe(201);
    const warningRuleId = warningRule.body.id as string;
    const dispatcher = context.app.get(NotificationDispatcher);
    await dispatcher.dispatch({
      ...createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()),
      payload: {
        metricKeys: ['errors.rate'],
        breaches: [
          {
            ruleId: crypto.randomUUID(),
            metricKey: 'errors.rate',
            metricValue: 3,
            threshold: 1,
            operator: 'GT',
            windowMinutes: 10,
          },
        ],
      },
    });
    const criticalDeliveries = await context.http
      .get('/notifications/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ ruleId: criticalRuleId, status: 'SENT', limit: 10, offset: 0 });
    expect(criticalDeliveries.status).toBe(200);
    expect(criticalDeliveries.body.data.length).toBe(1);
    const warningDeliveries = await context.http
      .get('/notifications/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ ruleId: warningRuleId, limit: 10, offset: 0 });
    expect(warningDeliveries.status).toBe(200);
    expect(warningDeliveries.body.data.length).toBe(1);
    expect(fetchCalls).toBe(2);
  });
  it('suppresses duplicate notifications by dedupe window', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `SlackDedup ${crypto.randomUUID().slice(0, 8)}`,
        type: 'SLACK',
        config: {
          webhookUrl: 'https://hooks.slack.test/services/dedup',
        },
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    const createRule = await context.http
      .post('/notifications/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Dedup rule ${crypto.randomUUID().slice(0, 8)}`,
        event: 'GuardrailTriggered',
        scopeType: 'EXPERIMENT',
        scopeValue: experimentId,
        dedupeWindowSec: 120,
        rateLimitCount: 10,
        rateLimitWindowSec: 3600,
        targets: [{ channelId }],
      });
    expect(createRule.status).toBe(201);
    const ruleId = createRule.body.id as string;
    const dispatcher = context.app.get(NotificationDispatcher);
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    expect(fetchCalls).toBe(1);
    const deliveries = await context.http
      .get('/notifications/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ ruleId, limit: 10, offset: 0 });
    expect(deliveries.status).toBe(200);
    expect(deliveries.body.data.length).toBe(2);
    const statuses = new Set<string>(
      (deliveries.body.data as Array<Record<string, unknown>>).map((item) => item.status as string),
    );
    expect(statuses.has('SENT')).toBe(true);
    expect(statuses.has('SUPPRESSED_DEDUP')).toBe(true);
  });
  it('matches scope rules for ANY, EXPERIMENT, FLAG and OWNER', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId, ownerId, flagKey } = await createRunningExperiment(context);
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `SlackScope ${crypto.randomUUID().slice(0, 8)}`,
        type: 'SLACK',
        config: {
          webhookUrl: 'https://hooks.slack.test/services/scope',
        },
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    async function createRule(scopeType: string, scopeValue: string | null): Promise<string> {
      const response = await context.http
        .post('/notifications/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Scope ${scopeType} ${crypto.randomUUID().slice(0, 6)}`,
          event: 'GuardrailTriggered',
          scopeType,
          scopeValue,
          dedupeWindowSec: 1,
          rateLimitCount: 10,
          rateLimitWindowSec: 3600,
          targets: [{ channelId }],
        });
      expect(response.status).toBe(201);
      return response.body.id as string;
    }
    const anyRuleId = await createRule('ANY', null);
    const experimentRuleId = await createRule('EXPERIMENT', experimentId);
    const flagRuleId = await createRule('FLAG', flagKey);
    const ownerRuleId = await createRule('OWNER', ownerId);
    const mismatchRuleId = await createRule('EXPERIMENT', crypto.randomUUID());
    const dispatcher = context.app.get(NotificationDispatcher);
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    expect(fetchCalls).toBe(4);
    async function expectSent(ruleId: string, expectedCount: number): Promise<void> {
      const deliveries = await context.http
        .get('/notifications/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ ruleId, status: 'SENT', limit: 10, offset: 0 });
      expect(deliveries.status).toBe(200);
      expect(deliveries.body.data.length).toBe(expectedCount);
    }
    await expectSent(anyRuleId, 1);
    await expectSent(experimentRuleId, 1);
    await expectSent(flagRuleId, 1);
    await expectSent(ownerRuleId, 1);
    await expectSent(mismatchRuleId, 0);
  });
  it('sends telegram notifications and renders configured template', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    const fetchCalls: Array<{
      url: string;
      body: string;
    }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        url: typeof input === 'string' ? input : input.toString(),
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Telegram ${crypto.randomUUID().slice(0, 8)}`,
        type: 'TELEGRAM',
        config: {
          botToken: 'telegram-bot-token',
          chatId: '-100100',
        },
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    const createRule = await context.http
      .post('/notifications/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Telegram template ${crypto.randomUUID().slice(0, 8)}`,
        event: 'GuardrailTriggered',
        scopeType: 'EXPERIMENT',
        scopeValue: experimentId,
        dedupeWindowSec: 1,
        messageTemplate:
          'exp={{experiment.name}} flag={{experiment.flagKey}} env={{environment}} ev={{event.name}}',
        targets: [{ channelId }],
      });
    expect(createRule.status).toBe(201);
    const ruleId = createRule.body.id as string;
    const dispatcher = context.app.get(NotificationDispatcher);
    await dispatcher.dispatch(createGuardrailTriggeredEnvelope(experimentId, crypto.randomUUID()));
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]?.url).toContain(
      'https://api.telegram.org/bottelegram-bot-token/sendMessage',
    );
    const requestBody = JSON.parse(fetchCalls[0]?.body ?? '{}') as Record<string, unknown>;
    expect(requestBody.chat_id).toBe('-100100');
    expect(typeof requestBody.text).toBe('string');
    expect((requestBody.text as string).includes('env=')).toBe(true);
    expect((requestBody.text as string).includes('ev=GuardrailTriggered')).toBe(true);
    const deliveries = await context.http
      .get('/notifications/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ ruleId, status: 'SENT', limit: 10, offset: 0 });
    expect(deliveries.status).toBe(200);
    expect(deliveries.body.data.length).toBe(1);
  });
  it('dispatches lifecycle events mapped to notification rules', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const createChannel = await context.http
      .post('/notifications/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `SlackLifecycle ${crypto.randomUUID().slice(0, 8)}`,
        type: 'SLACK',
        config: {
          webhookUrl: 'https://hooks.slack.test/services/lifecycle',
        },
        isEnabled: true,
      });
    expect(createChannel.status).toBe(201);
    const channelId = createChannel.body.id as string;
    const lifecycleRules: Array<{
      event: string;
      eventName: ReturnType<typeof createLifecycleEnvelope>['eventName'];
      ruleId: string;
    }> = [];
    const eventPairs: Array<{
      ruleEvent:
        | 'ExperimentSubmittedForReview'
        | 'ExperimentApproved'
        | 'ExperimentRejected'
        | 'ExperimentStarted'
        | 'ExperimentPaused'
        | 'ExperimentResumed'
        | 'ExperimentCompleted';
      controlEvent:
        | 'ExperimentSubmittedForReview'
        | 'ExperimentApproved'
        | 'ExperimentRejected'
        | 'ExperimentStarted'
        | 'ExperimentPaused'
        | 'ExperimentResumed'
        | 'ExperimentCompleted';
    }> = [
      {
        ruleEvent: 'ExperimentSubmittedForReview',
        controlEvent: 'ExperimentSubmittedForReview',
      },
      { ruleEvent: 'ExperimentApproved', controlEvent: 'ExperimentApproved' },
      { ruleEvent: 'ExperimentRejected', controlEvent: 'ExperimentRejected' },
      { ruleEvent: 'ExperimentStarted', controlEvent: 'ExperimentStarted' },
      { ruleEvent: 'ExperimentPaused', controlEvent: 'ExperimentPaused' },
      { ruleEvent: 'ExperimentResumed', controlEvent: 'ExperimentResumed' },
      { ruleEvent: 'ExperimentCompleted', controlEvent: 'ExperimentCompleted' },
    ];
    for (const pair of eventPairs) {
      const response = await context.http
        .post('/notifications/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Lifecycle ${pair.ruleEvent} ${crypto.randomUUID().slice(0, 6)}`,
          event: pair.ruleEvent,
          scopeType: 'EXPERIMENT',
          scopeValue: experimentId,
          dedupeWindowSec: 1,
          targets: [{ channelId }],
        });
      expect(response.status).toBe(201);
      lifecycleRules.push({
        event: pair.ruleEvent,
        eventName: pair.controlEvent,
        ruleId: response.body.id as string,
      });
    }
    const dispatcher = context.app.get(NotificationDispatcher);
    for (const rule of lifecycleRules) {
      await dispatcher.dispatch(createLifecycleEnvelope(experimentId, rule.eventName));
    }
    expect(fetchCalls).toBe(lifecycleRules.length);
    for (const rule of lifecycleRules) {
      const deliveries = await context.http
        .get('/notifications/deliveries')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ ruleId: rule.ruleId, status: 'SENT', limit: 10, offset: 0 });
      expect(deliveries.status).toBe(200);
      expect(deliveries.body.data.length).toBe(1);
      const payload = deliveries.body.data[0]?.payload as Record<string, unknown>;
      expect(payload?.eventName).toBe(rule.eventName);
    }
  });
});
