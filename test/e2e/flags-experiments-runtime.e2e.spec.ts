import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentOutcomeType, ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { Role } from '@/apps/control-api/domain/user';
import { ParticipationLimiter } from '@/apps/decide-api/application/subject-participation/participation-limiter';
import { DecisionReason } from '@/apps/decide-api/domain';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createExperiment,
  createFlag,
  createUser,
  syncRuntimeSnapshotForExperiment,
  syncRuntimeSnapshotForFlag,
  waitForExperimentStatus,
} from './factories';

vi.setConfig({ testTimeout: 30000 });
applyMigrations();
async function createAndStartExperiment(
  context: E2EContext,
  input: {
    ownerId: string;
    approverId: string;
    flagId: string;
    conflictDomain?: string | null;
    priority?: number;
    targetingRule?: unknown;
    audiencePercent?: number;
  },
): Promise<string> {
  const experimentId = await createExperiment(context.http, {
    actorId: input.ownerId,
    flagId: input.flagId,
    conflictDomain: input.conflictDomain,
    priority: input.priority,
    targetingRule: input.targetingRule,
    audiencePercent: input.audiencePercent,
  });
  const submit = await context.http
    .post(`/experiments/${experimentId}/submit`)
    .set('Authorization', authHeaderForUser(input.ownerId));
  expect(submit.status).toBe(200);
  const approve = await context.http
    .post(`/experiments/${experimentId}/approve`)
    .set('Authorization', authHeaderForUser(input.approverId))
    .send({ comment: 'approved for runtime tests' });
  expect(approve.status).toBe(200);
  const start = await context.http
    .post(`/experiments/${experimentId}/start`)
    .set('Authorization', authHeaderForUser(input.ownerId));
  expect(start.status).toBe(200);
  await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, input.ownerId);
  await syncRuntimeSnapshotForExperiment(context, experimentId);
  return experimentId;
}
describe('flags and runtime decide e2e', () => {
  let context: E2EContext;
  beforeAll(async () => {
    context = await createE2EContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
    await resetE2ETestDoubles(context);
  });
  afterAll(async () => {
    if (context) {
      await closeE2EContext(context);
    }
  });
  it('returns default value when no active experiment applies', async () => {
    const flagId = await createFlag(context.http, {
      key: `button_color_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'green',
    });
    await syncRuntimeSnapshotForFlag(context, flagId);
    const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    const decide = await context.http.post('/decide').send({
      subjectId: `subject-${crypto.randomUUID()}`,
      attributes: { country: 'RU' },
      flagKeys: [flag.key],
    });
    expect(decide.status).toBe(200);
    expect(decide.body.decisions).toHaveLength(1);
    expect(decide.body.decisions[0].reason).toBe(DecisionReason.FLAG_DEFAULT);
    expect(decide.body.decisions[0].value).toBe('green');
  });
  it('returns TARGETING_NOT_MATCHED and default when targeting does not match', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `targeted_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const experimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId,
      targetingRule: {
        attribute: 'country',
        op: 'eq',
        value: 'RU',
      },
    });
    expect(typeof experimentId).toBe('string');
    const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    const decide = await context.http.post('/decide').send({
      subjectId: `subject-${crypto.randomUUID()}`,
      attributes: { country: 'US' },
      flagKeys: [flag.key],
    });
    expect(decide.status).toBe(200);
    expect(decide.body.decisions).toHaveLength(1);
    expect(decide.body.decisions[0].reason).toBe(DecisionReason.TARGETING_NOT_MATCHED);
    expect(decide.body.decisions[0].value).toBe('A');
  });
  it('keeps assignment sticky for the same subject in unchanged configuration', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `sticky_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    await createAndStartExperiment(context, { ownerId, approverId, flagId });
    const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    const subjectId = `sticky-${crypto.randomUUID()}`;
    const decideFirst = await context.http.post('/decide').send({
      subjectId,
      attributes: { country: 'RU' },
      flagKeys: [flag.key],
    });
    const decideSecond = await context.http.post('/decide').send({
      subjectId,
      attributes: { country: 'RU' },
      flagKeys: [flag.key],
    });
    expect(decideFirst.status).toBe(200);
    expect(decideSecond.status).toBe(200);
    const first = decideFirst.body.decisions[0];
    const second = decideSecond.body.decisions[0];
    expect(first.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(second.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(first.variantId).toBe(second.variantId);
    expect(first.value).toBe(second.value);
  });
  it('returns EXPERIMENT_PAUSED after pause and blocks config update while paused', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `paused_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const experimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId,
      audiencePercent: 100,
    });
    const pause = await context.http
      .post(`/experiments/${experimentId}/pause`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(pause.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.PAUSED, ownerId);
    await syncRuntimeSnapshotForExperiment(context, experimentId);
    const patchWhilePaused = await context.http
      .patch(`/experiments/${experimentId}`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({ audiencePercent: 50 });
    expect(patchWhilePaused.status).toBe(409);
    const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    const decide = await context.http.post('/decide').send({
      subjectId: `paused-${crypto.randomUUID()}`,
      attributes: {},
      flagKeys: [flag.key],
    });
    expect(decide.status).toBe(200);
    expect(decide.body.decisions[0].reason).toBe(DecisionReason.EXPERIMENT_PAUSED);
  });
  it('blocks config update while experiment is running', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `running_freeze_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const experimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId,
      audiencePercent: 100,
    });
    const patchAudience = await context.http
      .patch(`/experiments/${experimentId}`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({ audiencePercent: 50 });
    expect(patchAudience.status).toBe(409);
    expect(patchAudience.body.code).toBe('EXPERIMENT_NOT_EDITABLE');
    const patchTargeting = await context.http
      .patch(`/experiments/${experimentId}`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        targetingRule: {
          attribute: 'country',
          op: 'eq',
          value: 'US',
        },
      });
    expect(patchTargeting.status).toBe(409);
    expect(patchTargeting.body.code).toBe('EXPERIMENT_NOT_EDITABLE');
  });
  it('resolves conflict domain by priority and returns EXPERIMENT_CONFLICT for loser', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const highFlagId = await createFlag(context.http, {
      key: `conflict_high_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const lowFlagId = await createFlag(context.http, {
      key: `conflict_low_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: highFlagId,
      conflictDomain: 'checkout',
      priority: 100,
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: lowFlagId,
      conflictDomain: 'checkout',
      priority: 10,
    });
    const [highFlag, lowFlag] = await Promise.all([
      context.prisma.flag.findUniqueOrThrow({ where: { id: highFlagId } }),
      context.prisma.flag.findUniqueOrThrow({ where: { id: lowFlagId } }),
    ]);
    const decide = await context.http.post('/decide').send({
      subjectId: `conflict-${crypto.randomUUID()}`,
      attributes: {},
      flagKeys: [highFlag.key, lowFlag.key],
    });
    expect(decide.status).toBe(200);
    expect(decide.body.decisions).toHaveLength(2);
    const byFlagKey = new Map<string, (typeof decide.body.decisions)[number]>(
      decide.body.decisions.map((decision: (typeof decide.body.decisions)[number]) => [
        decision.flagKey,
        decision,
      ]),
    );
    expect(byFlagKey.get(highFlag.key)?.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(byFlagKey.get(lowFlag.key)?.reason).toBe(DecisionReason.EXPERIMENT_CONFLICT);
  });
  it('does not create conflict across different conflict domains', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const checkoutFlagId = await createFlag(context.http, {
      key: `domain_checkout_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const searchFlagId = await createFlag(context.http, {
      key: `domain_search_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: checkoutFlagId,
      conflictDomain: 'checkout',
      priority: 100,
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: searchFlagId,
      conflictDomain: 'search',
      priority: 1,
    });
    const [checkoutFlag, searchFlag] = await Promise.all([
      context.prisma.flag.findUniqueOrThrow({ where: { id: checkoutFlagId } }),
      context.prisma.flag.findUniqueOrThrow({ where: { id: searchFlagId } }),
    ]);
    const decide = await context.http.post('/decide').send({
      subjectId: `cross-domain-${crypto.randomUUID()}`,
      attributes: {},
      flagKeys: [checkoutFlag.key, searchFlag.key],
    });
    expect(decide.status).toBe(200);
    expect(decide.body.decisions).toHaveLength(2);
    expect(
      decide.body.decisions.every(
        (decision: (typeof decide.body.decisions)[number]) =>
          decision.reason === DecisionReason.EXPERIMENT_ASSIGNED,
      ),
    ).toBe(true);
  });
  it('validates second experiment lifecycle on same flag', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `single_active_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const firstExperimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId,
    });
    expect(typeof firstExperimentId).toBe('string');
    const createSecond = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        name: `Second ${crypto.randomUUID().slice(0, 8)}`,
        description: 'second experiment on same flag',
        flagId,
        audiencePercent: 100,
        variants: [
          { name: 'Control', value: 'A', weight: 50, isControl: true },
          { name: 'Treatment', value: 'B', weight: 50, isControl: false },
        ],
      });
    expect([201, 409]).toContain(createSecond.status);
    if (createSecond.status === 409) {
      expect(createSecond.body.code).toBe('EXPERIMENT_ALREADY_EXISTS_FOR_FLAG');
      return;
    }
    const secondExperimentId = createSecond.body.id as string;
    const submitSecond = await context.http
      .post(`/experiments/${secondExperimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submitSecond.status).toBe(200);
    const approveSecond = await context.http
      .post(`/experiments/${secondExperimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approved second experiment' });
    expect(approveSecond.status).toBe(200);
    const startSecond = await context.http
      .post(`/experiments/${secondExperimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect([200, 409]).toContain(startSecond.status);
  });
  it('limits concurrent experiment assignments for a single subject', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagKeys: string[] = [];
    for (let index = 0; index < 4; index++) {
      const flagId = await createFlag(context.http, {
        key: `limit_flag_${index}_${crypto.randomUUID().slice(0, 8)}`,
        defaultValue: 'A',
      });
      await createAndStartExperiment(context, {
        ownerId,
        approverId,
        flagId,
        conflictDomain: `domain-${index}`,
      });
      const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
      flagKeys.push(flag.key);
    }
    const decide = await context.http.post('/decide').send({
      subjectId: `limit-${crypto.randomUUID()}`,
      attributes: {},
      flagKeys,
    });
    expect(decide.status).toBe(200);
    expect(decide.body.decisions).toHaveLength(4);
    const assigned = decide.body.decisions.filter(
      (decision: (typeof decide.body.decisions)[number]) =>
        decision.reason === DecisionReason.EXPERIMENT_ASSIGNED,
    );
    const limited = decide.body.decisions.filter(
      (decision: (typeof decide.body.decisions)[number]) =>
        decision.reason === DecisionReason.PARTICIPATION_LIMIT_EXCEEDED,
    );
    expect(assigned.length).toBe(3);
    expect(limited.length).toBe(1);
  });
  it('rejects invalid lifecycle transitions for start pause resume', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `lifecycle_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const experimentId = await createExperiment(context.http, {
      actorId: ownerId,
      flagId,
    });
    const startFromDraft = await context.http
      .post(`/experiments/${experimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(startFromDraft.status).toBe(409);
    expect(startFromDraft.body.code).toBe('INVALID_STATUS_TRANSITION');
    const pauseFromDraft = await context.http
      .post(`/experiments/${experimentId}/pause`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(pauseFromDraft.status).toBe(409);
    expect(pauseFromDraft.body.code).toBe('INVALID_STATUS_TRANSITION');
    await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approved for lifecycle transition test' });
    await context.http
      .post(`/experiments/${experimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);
    const resumeFromRunning = await context.http
      .post(`/experiments/${experimentId}/resume`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(resumeFromRunning.status).toBe(409);
    expect(resumeFromRunning.body.code).toBe('INVALID_STATUS_TRANSITION');
  });
  it('handles repeated assignment attempts for the same subject under participation policy', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const subjectId = `cooldown-${crypto.randomUUID().slice(0, 8)}`;
    const assignmentCountForCooldown = 5;
    const limiter = context.app.get(ParticipationLimiter, { strict: false });
    for (let index = 0; index < assignmentCountForCooldown; index++) {
      const flagId = await createFlag(context.http, {
        key: `cooldown_flag_${index}_${crypto.randomUUID().slice(0, 8)}`,
        defaultValue: 'A',
      });
      const experimentId = await createAndStartExperiment(context, {
        ownerId,
        approverId,
        flagId,
        conflictDomain: `cooldown-domain-${index}`,
      });
      const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
      const decideAssigned = await context.http.post('/decide').send({
        subjectId,
        attributes: {},
        flagKeys: [flag.key],
      });
      expect(decideAssigned.status).toBe(200);
      expect(
        [DecisionReason.EXPERIMENT_ASSIGNED, DecisionReason.PARTICIPATION_LIMIT_EXCEEDED].includes(
          decideAssigned.body.decisions[0]?.reason as DecisionReason,
        ),
      ).toBe(true);
      const complete = await context.http
        .post(`/experiments/${experimentId}/complete`)
        .set('Authorization', authHeaderForUser(ownerId))
        .send({
          outcomeType: ExperimentOutcomeType.NO_EFFECT,
          comment: 'closing experiment to test cooldown policy',
        });
      expect(complete.status).toBe(200);
      await waitForExperimentStatus(context, experimentId, ExperimentStatus.COMPLETED, ownerId);
      await syncRuntimeSnapshotForExperiment(context, experimentId);
      await limiter.removeExperimentForSubjects(experimentId, [subjectId]);
    }
    const sixthFlagId = await createFlag(context.http, {
      key: `cooldown_flag_6_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: sixthFlagId,
      conflictDomain: 'cooldown-domain-6',
    });
    const sixthFlag = await context.prisma.flag.findUniqueOrThrow({ where: { id: sixthFlagId } });
    const cooldownDecide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [sixthFlag.key],
    });
    expect(cooldownDecide.status).toBe(200);
    expect(cooldownDecide.body.decisions).toHaveLength(1);
    expect(
      [DecisionReason.PARTICIPATION_LIMIT_EXCEEDED, DecisionReason.EXPERIMENT_ASSIGNED].includes(
        cooldownDecide.body.decisions[0]?.reason as DecisionReason,
      ),
    ).toBe(true);
  });
  it('resolves equal-priority conflicts deterministically for repeated requests', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const firstFlagId = await createFlag(context.http, {
      key: `equal_prio_flag_a_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const secondFlagId = await createFlag(context.http, {
      key: `equal_prio_flag_b_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const firstExperimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: firstFlagId,
      conflictDomain: 'checkout',
      priority: 50,
    });
    const secondExperimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: secondFlagId,
      conflictDomain: 'checkout',
      priority: 50,
    });
    const [firstFlag, secondFlag] = await Promise.all([
      context.prisma.flag.findUniqueOrThrow({ where: { id: firstFlagId } }),
      context.prisma.flag.findUniqueOrThrow({ where: { id: secondFlagId } }),
    ]);
    const subjectId = `equal-priority-${crypto.randomUUID().slice(0, 8)}`;
    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [firstFlag.key, secondFlag.key],
    });
    expect(decide.status).toBe(200);
    const decisions = decide.body.decisions as Array<{
      flagKey: string;
      reason: DecisionReason;
      experimentId: string | null;
    }>;
    const assigned = decisions.find((item) => item.reason === DecisionReason.EXPERIMENT_ASSIGNED);
    const conflicted = decisions.find((item) => item.reason === DecisionReason.EXPERIMENT_CONFLICT);
    expect(assigned).toBeDefined();
    expect(conflicted).toBeDefined();
    expect(
      assigned?.experimentId === firstExperimentId || assigned?.experimentId === secondExperimentId,
    ).toBe(true);
    const secondDecide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [firstFlag.key, secondFlag.key],
    });
    expect(secondDecide.status).toBe(200);
    const secondAssigned = (
      secondDecide.body.decisions as Array<{
        reason: DecisionReason;
        experimentId: string | null;
      }>
    ).find((item) => item.reason === DecisionReason.EXPERIMENT_ASSIGNED);
    expect(secondAssigned?.experimentId).toBe(assigned?.experimentId ?? null);
  });
  it('keeps equal-priority tie-break deterministic even when requested flag order changes', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const firstFlagId = await createFlag(context.http, {
      key: `equal_order_flag_a_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const secondFlagId = await createFlag(context.http, {
      key: `equal_order_flag_b_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const firstExperimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: firstFlagId,
      conflictDomain: 'recommendations',
      priority: 20,
    });
    const secondExperimentId = await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: secondFlagId,
      conflictDomain: 'recommendations',
      priority: 20,
    });
    const [firstFlag, secondFlag] = await Promise.all([
      context.prisma.flag.findUniqueOrThrow({ where: { id: firstFlagId } }),
      context.prisma.flag.findUniqueOrThrow({ where: { id: secondFlagId } }),
    ]);
    const subjectId = `equal-order-${crypto.randomUUID().slice(0, 8)}`;
    const decideForward = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [firstFlag.key, secondFlag.key],
    });
    expect(decideForward.status).toBe(200);
    const forwardWinner = (
      decideForward.body.decisions as Array<{
        reason: DecisionReason;
        experimentId: string | null;
      }>
    ).find((item) => item.reason === DecisionReason.EXPERIMENT_ASSIGNED);
    expect(forwardWinner).toBeDefined();
    expect(
      forwardWinner?.experimentId === firstExperimentId ||
        forwardWinner?.experimentId === secondExperimentId,
    ).toBe(true);
    const decideReversed = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [secondFlag.key, firstFlag.key],
    });
    expect(decideReversed.status).toBe(200);
    const reversedWinner = (
      decideReversed.body.decisions as Array<{
        reason: DecisionReason;
        experimentId: string | null;
      }>
    ).find((item) => item.reason === DecisionReason.EXPERIMENT_ASSIGNED);
    expect(reversedWinner?.experimentId).toBe(forwardWinner?.experimentId ?? null);
  });
  it('handles competing experiments in same conflict domain across sequential requests', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const firstFlagId = await createFlag(context.http, {
      key: `occupied_domain_flag_a_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const secondFlagId = await createFlag(context.http, {
      key: `occupied_domain_flag_b_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: firstFlagId,
      conflictDomain: 'search',
      priority: 100,
    });
    await createAndStartExperiment(context, {
      ownerId,
      approverId,
      flagId: secondFlagId,
      conflictDomain: 'search',
      priority: 10,
    });
    const [firstFlag, secondFlag] = await Promise.all([
      context.prisma.flag.findUniqueOrThrow({ where: { id: firstFlagId } }),
      context.prisma.flag.findUniqueOrThrow({ where: { id: secondFlagId } }),
    ]);
    const subjectId = `occupied-domain-${crypto.randomUUID().slice(0, 8)}`;
    const firstDecide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [firstFlag.key],
    });
    expect(firstDecide.status).toBe(200);
    expect(firstDecide.body.decisions[0]?.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    const secondDecide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [secondFlag.key],
    });
    expect(secondDecide.status).toBe(200);
    expect(
      [DecisionReason.EXPERIMENT_CONFLICT, DecisionReason.EXPERIMENT_ASSIGNED].includes(
        secondDecide.body.decisions[0]?.reason as DecisionReason,
      ),
    ).toBe(true);
  });
});
