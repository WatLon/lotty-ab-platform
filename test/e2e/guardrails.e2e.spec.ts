import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';
import { Role } from '@/apps/control-api/domain/user';
import { GuardrailWorkersModule } from '@/apps/control-api/infrastructure/guardrail/guardrails';
import { GuardrailActionExecutorService } from '@/apps/control-api/infrastructure/guardrail/guardrails/guardrail-action-executor.service';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createExperiment,
  createFlag,
  createMetricDefinition,
  createUser,
  materializeExperimentProjectionForFk,
  syncRuntimeSnapshotForExperiment,
  waitForExperimentStatus,
} from './factories';

vi.setConfig({ testTimeout: 30000 });
applyMigrations();
async function createRunningExperiment(
  context: E2EContext,
  metricId?: string,
): Promise<{
  ownerId: string;
  experimentId: string;
}> {
  const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
  const approverId = await createUser(context.http, { role: Role.APPROVER });
  await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
  const flagId = await createFlag(context.http, {
    key: `guardrail_flag_${crypto.randomUUID().slice(0, 8)}`,
    defaultValue: 'A',
  });
  const experimentId = await createExperiment(context.http, {
    actorId: ownerId,
    flagId,
    autoAttachPrimaryMetric: metricId ? false : undefined,
    metricIds: metricId ? [metricId] : undefined,
    primaryMetricId: metricId ?? undefined,
  });
  const submit = await context.http
    .post(`/experiments/${experimentId}/submit`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(submit.status).toBe(200);
  const approve = await context.http
    .post(`/experiments/${experimentId}/approve`)
    .set('Authorization', authHeaderForUser(approverId))
    .send({ comment: 'approved for guardrail tests' });
  expect(approve.status).toBe(200);
  const start = await context.http
    .post(`/experiments/${experimentId}/start`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(start.status).toBe(200);
  await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);
  await materializeExperimentProjectionForFk(context, experimentId);
  await syncRuntimeSnapshotForExperiment(context, experimentId);
  return { ownerId, experimentId };
}
function getGuardrailActionExecutor(context: E2EContext): GuardrailActionExecutorService {
  return context.app
    .select(GuardrailWorkersModule)
    .get(GuardrailActionExecutorService, { strict: true });
}
describe('guardrails e2e', () => {
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
  it('supports guardrail rule CRUD via HTTP', async () => {
    const metricId = await createMetricDefinition(context.http, {
      formula: {
        type: 'COUNT',
        eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.errors`,
      },
    });
    const { ownerId, experimentId } = await createRunningExperiment(context, metricId);
    const createRule = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 1,
        operator: 'GT',
        windowMinutes: 10,
        action: 'PAUSE',
      });
    expect(createRule.status).toBe(201);
    const guardrailId = createRule.body.id as string;
    expect(typeof guardrailId).toBe('string');
    const listRules = await context.http
      .get(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(listRules.status).toBe(200);
    expect(Array.isArray(listRules.body.data)).toBe(true);
    expect(listRules.body.data.length).toBe(1);
    const updateRule = await context.http
      .patch(`/experiments/${experimentId}/guardrails/${guardrailId}`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({ threshold: 2, operator: 'GTE' });
    expect(updateRule.status).toBe(200);
    const getRule = await context.http
      .get(`/experiments/${experimentId}/guardrails/${guardrailId}`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(getRule.status).toBe(200);
    expect(getRule.body.threshold).toBe(2);
    expect(getRule.body.operator).toBe('GTE');
    const deleteRule = await context.http
      .delete(`/experiments/${experimentId}/guardrails/${guardrailId}`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(deleteRule.status).toBe(200);
    const listAfterDelete = await context.http
      .get(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(listAfterDelete.status).toBe(200);
    expect(Array.isArray(listAfterDelete.body.data)).toBe(true);
    expect(listAfterDelete.body.data.length).toBe(0);
  });
  it('lists guardrail triggers via HTTP with filters and access control', async () => {
    const metricKey = `event.${crypto.randomUUID().slice(0, 8)}.trigger_history`;
    const metricId = await createMetricDefinition(context.http, {
      key: `metric_${crypto.randomUUID().slice(0, 8)}_guardrail_trigger_history`,
      formula: {
        type: 'COUNT',
        eventTypeKey: metricKey,
      },
    });
    const { ownerId, experimentId } = await createRunningExperiment(context, metricId);
    const createRule = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 1,
        operator: 'GT',
        windowMinutes: 10,
        action: 'PAUSE',
      });
    expect(createRule.status).toBe(201);
    const guardrailId = createRule.body.id as string;

    const actionExecutor = getGuardrailActionExecutor(context);
    await actionExecutor.execute(experimentId, [
      {
        ruleId: guardrailId,
        threshold: 1,
        action: GuardrailAction.PAUSE,
        operator: ComparisonOperator.GT,
        metricKey,
        metricValue: 2,
        windowMinutes: 10,
      },
    ]);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.PAUSED, ownerId);

    const resume = await context.http
      .post(`/experiments/${experimentId}/resume`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(resume.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);

    await new Promise((resolve) => setTimeout(resolve, 10));

    await actionExecutor.execute(experimentId, [
      {
        ruleId: guardrailId,
        threshold: 1,
        action: GuardrailAction.PAUSE,
        operator: ComparisonOperator.GT,
        metricKey,
        metricValue: 3,
        windowMinutes: 10,
      },
    ]);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.PAUSED, ownerId);

    const listTriggers = await context.http
      .get(`/experiments/${experimentId}/guardrail-triggers`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(listTriggers.status).toBe(200);
    expect(listTriggers.body.total).toBe(2);
    expect(Array.isArray(listTriggers.body.data)).toBe(true);
    expect(listTriggers.body.data.length).toBe(2);
    expect(listTriggers.body.data[0]).toMatchObject({
      guardrailId,
      actionTaken: 'PAUSE',
      threshold: 1,
    });
    expect(listTriggers.body.data[0]).not.toHaveProperty('experimentId');
    expect(Date.parse(listTriggers.body.data[0].triggeredAt)).toBeGreaterThanOrEqual(
      Date.parse(listTriggers.body.data[1].triggeredAt),
    );

    const filteredByGuardrail = await context.http
      .get(`/experiments/${experimentId}/guardrail-triggers`)
      .query({ guardrailId })
      .set('Authorization', authHeaderForUser(ownerId));
    expect(filteredByGuardrail.status).toBe(200);
    expect(filteredByGuardrail.body.total).toBe(2);
    expect(filteredByGuardrail.body.data.length).toBe(2);

    const filteredByAction = await context.http
      .get(`/experiments/${experimentId}/guardrail-triggers`)
      .query({ actionTaken: 'ROLLBACK' })
      .set('Authorization', authHeaderForUser(ownerId));
    expect(filteredByAction.status).toBe(200);
    expect(filteredByAction.body.total).toBe(0);
    expect(filteredByAction.body.data.length).toBe(0);

    const anotherExperimenterId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const forbidden = await context.http
      .get(`/experiments/${experimentId}/guardrail-triggers`)
      .set('Authorization', authHeaderForUser(anotherExperimenterId));
    expect(forbidden.status).toBe(403);
  });
  it('auto-pauses running experiment when guardrail threshold is breached', async () => {
    const metricKey = `event.${crypto.randomUUID().slice(0, 8)}.errors`;
    const metricId = await createMetricDefinition(context.http, {
      key: `metric_${crypto.randomUUID().slice(0, 8)}_error_count`,
      formula: {
        type: 'COUNT',
        eventTypeKey: metricKey,
      },
    });
    const { ownerId, experimentId } = await createRunningExperiment(context, metricId);
    const createRule = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 1,
        operator: 'GT',
        windowMinutes: 10,
        action: 'PAUSE',
      });
    expect(createRule.status).toBe(201);
    const guardrailId = createRule.body.id as string;
    expect(typeof guardrailId).toBe('string');
    const actionExecutor = getGuardrailActionExecutor(context);
    await actionExecutor.execute(experimentId, [
      {
        ruleId: guardrailId,
        threshold: 1,
        action: GuardrailAction.PAUSE,
        operator: ComparisonOperator.GT,
        metricKey,
        metricValue: 2,
        windowMinutes: 10,
      },
    ]);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.PAUSED, ownerId);
    const triggers = await context.prisma.guardrailTrigger.findMany({
      where: { experimentId },
      include: { guardrail: true },
    });
    expect(triggers.length).toBe(1);
    expect(triggers[0]?.actionTaken).toBe('PAUSE');
    expect(triggers[0]?.threshold).toBe(1);
    expect(triggers[0]?.metricValue).toBe(2);
    expect(triggers[0]?.guardrailId).toBe(guardrailId);
    expect(triggers[0]?.guardrail.windowMinutes).toBe(10);
    expect(triggers[0]?.guardrail.metricId).toBe(metricId);
    expect(triggers[0]?.triggeredAt instanceof Date).toBe(true);
  });
  it('records guardrail breaches in event stream before pause action', async () => {
    const metricKey = `event.${crypto.randomUUID().slice(0, 8)}.errors`;
    const metricId = await createMetricDefinition(context.http, {
      key: `metric_${crypto.randomUUID().slice(0, 8)}_event_order`,
      formula: {
        type: 'COUNT',
        eventTypeKey: metricKey,
      },
    });
    const { ownerId, experimentId } = await createRunningExperiment(context, metricId);
    const createRule = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 1,
        operator: 'GT',
        windowMinutes: 10,
        action: 'PAUSE',
      });
    expect(createRule.status).toBe(201);
    const guardrailId = createRule.body.id as string;
    const actionExecutor = getGuardrailActionExecutor(context);
    await actionExecutor.execute(experimentId, [
      {
        ruleId: guardrailId,
        threshold: 1,
        action: GuardrailAction.PAUSE,
        operator: ComparisonOperator.GT,
        metricKey,
        metricValue: 2,
        windowMinutes: 10,
      },
      {
        ruleId: guardrailId,
        threshold: 1,
        action: GuardrailAction.PAUSE,
        operator: ComparisonOperator.GT,
        metricKey,
        metricValue: 3,
        windowMinutes: 10,
      },
    ]);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.PAUSED, ownerId);
    const events = await context.prisma.experimentEvent.findMany({
      where: { aggregateId: experimentId },
      orderBy: { version: 'asc' },
      select: { eventType: true },
    });
    const pausedIndex = events.findIndex((eventRow) => eventRow.eventType === 'ExperimentPaused');
    expect(pausedIndex).toBeGreaterThan(-1);
  });
  it('auto-rollbacks running experiment when rollback guardrail threshold is breached', async () => {
    const metricKey = `event.${crypto.randomUUID().slice(0, 8)}.latency`;
    const metricId = await createMetricDefinition(context.http, {
      key: `metric_${crypto.randomUUID().slice(0, 8)}_latency`,
      formula: {
        type: 'COUNT',
        eventTypeKey: metricKey,
      },
    });
    const { ownerId, experimentId } = await createRunningExperiment(context, metricId);
    const createRule = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 1,
        operator: 'GT',
        windowMinutes: 5,
        action: 'ROLLBACK',
      });
    expect(createRule.status).toBe(201);
    const guardrailId = createRule.body.id as string;
    const actionExecutor = getGuardrailActionExecutor(context);
    await actionExecutor.execute(experimentId, [
      {
        ruleId: guardrailId,
        threshold: 1,
        action: GuardrailAction.ROLLBACK,
        operator: ComparisonOperator.GT,
        metricKey,
        metricValue: 3,
        windowMinutes: 5,
      },
    ]);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.COMPLETED, ownerId);
    const triggers = await context.prisma.guardrailTrigger.findMany({
      where: { experimentId },
    });
    expect(triggers.length).toBe(1);
    expect(triggers[0]?.actionTaken).toBe('ROLLBACK');
    const events = await context.prisma.experimentEvent.findMany({
      where: { aggregateId: experimentId },
      orderBy: { version: 'asc' },
      select: { eventType: true },
    });
    const completedIndex = events.findIndex(
      (eventRow) => eventRow.eventType === 'ExperimentCompleted',
    );
    expect(completedIndex).toBeGreaterThan(-1);
  });
  it('rejects duplicate guardrail rule for the same parameters', async () => {
    const metricId = await createMetricDefinition(context.http, {
      key: `metric_${crypto.randomUUID().slice(0, 8)}_dup_guardrail`,
      formula: {
        type: 'COUNT',
        eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.dup`,
      },
    });
    const { ownerId, experimentId } = await createRunningExperiment(context, metricId);
    const first = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 10,
        operator: 'GT',
        windowMinutes: 15,
        action: 'PAUSE',
      });
    expect(first.status).toBe(201);
    const duplicate = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 10,
        operator: 'GT',
        windowMinutes: 15,
        action: 'PAUSE',
      });
    expect(duplicate.status).toBe(409);
  });
});
