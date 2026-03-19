import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentOutcomeType, ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { Role } from '@/apps/control-api/domain/user';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createExperiment,
  createFlag,
  createMetricDefinition,
  createUser,
  getExperimentRuntimeState,
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

async function createRunningExperiment(
  context: E2EContext,
  metricId?: string,
): Promise<{ ownerId: string; experimentId: string }> {
  const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
  const approverId = await createUser(context.http, { role: Role.APPROVER });
  await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });

  const flagId = await createFlag(context.http, {
    key: `reports_flag_${crypto.randomUUID().slice(0, 8)}`,
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
    .send({ comment: 'approved for report tests' });
  expect(approve.status).toBe(200);

  const start = await context.http
    .post(`/experiments/${experimentId}/start`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(start.status).toBe(200);
  await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);

  return { ownerId, experimentId };
}

describe('reports and outcomes e2e', () => {
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

  it('returns report data by variant and metric and validates report window', async () => {
    const adminToken = await loginAsAdmin(context);
    const metricId = await createMetricDefinition(context.http, {
      formula: { type: 'COUNT', eventTypeKey: 'purchase' },
      key: `report_count_${crypto.randomUUID().slice(0, 8)}`,
    });
    const { experimentId } = await createRunningExperiment(context, metricId);
    await materializeExperimentProjectionForFk(context, experimentId);
    const runtimeState = await getExperimentRuntimeState(context, experimentId);
    expect(runtimeState?.variants.length).toBeGreaterThan(1);

    const report = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-01T01:00:00.000Z',
        bucket: 'minute',
      });

    expect(report.status).toBe(200);
    expect(report.body.experimentId).toBe(experimentId);
    expect(Array.isArray(report.body.variants)).toBe(true);
    expect(report.body.variants.length).toBe(2);
    expect(report.body.bucket).toBe('minute');
    expect(report.body.variants[0]?.metrics[0]?.metricKey).toBeDefined();
    expect(report.body.variants[0]?.metrics[0]).toHaveProperty('metricName');
    expect(report.body.variants[0]?.metrics[0]).toHaveProperty('isPrimary');
    expect(report.body.variants[0]?.metrics[0]).toHaveProperty('value');
    expect(Array.isArray(report.body.variants[0]?.metrics[0]?.points)).toBe(true);

    const viewerId = await createUser(context.http, { role: Role.VIEWER });
    const viewerReport = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', authHeaderForUser(viewerId))
      .query({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-01T01:00:00.000Z',
      });
    expect(viewerReport.status).toBe(200);

    const invalidWindow = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        from: '2026-02-01T01:00:00.000Z',
        to: '2026-02-01T01:00:00.000Z',
      });
    expect(invalidWindow.status).toBe(400);

    const invalidBucket = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-01T01:00:00.000Z',
        bucket: 'day',
      });
    expect(invalidBucket.status).toBe(400);
  });

  it('normalizes report window by bucket boundaries (floor/ceil)', async () => {
    const adminToken = await loginAsAdmin(context);
    const { experimentId } = await createRunningExperiment(context);
    await materializeExperimentProjectionForFk(context, experimentId);

    const report = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        from: '2026-02-01T00:00:30.000Z',
        to: '2026-02-01T00:01:01.000Z',
        bucket: 'minute',
      });

    expect(report.status).toBe(200);
    expect(report.body.from).toBe('2026-02-01T00:00:00.000Z');
    expect(report.body.to).toBe('2026-02-01T00:02:00.000Z');
    expect(report.body.bucket).toBe('minute');

    const hourlyReport = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        from: '2026-02-01T00:10:30.000Z',
        to: '2026-02-01T01:01:01.000Z',
        bucket: 'hour',
      });

    expect(hourlyReport.status).toBe(200);
    expect(hourlyReport.body.from).toBe('2026-02-01T00:00:00.000Z');
    expect(hourlyReport.body.to).toBe('2026-02-01T02:00:00.000Z');
    expect(hourlyReport.body.bucket).toBe('hour');
  });

  it('completes experiment with NO_EFFECT and validates ROLLOUT_WINNER requirements', async () => {
    const { ownerId, experimentId } = await createRunningExperiment(context);

    const invalidComplete = await context.http
      .post(`/experiments/${experimentId}/complete`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        outcomeType: ExperimentOutcomeType.ROLLOUT_WINNER,
        comment: 'winner should be required',
      });
    expect(invalidComplete.status).toBe(400);

    const completeNoEffect = await context.http
      .post(`/experiments/${experimentId}/complete`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        outcomeType: ExperimentOutcomeType.NO_EFFECT,
        comment: '   ',
      });
    expect(completeNoEffect.status).toBe(400);

    const validNoEffect = await context.http
      .post(`/experiments/${experimentId}/complete`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        outcomeType: ExperimentOutcomeType.NO_EFFECT,
        comment: 'No significant change',
      });
    expect(validNoEffect.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.COMPLETED, ownerId);

    const experimentAfterNoEffect = await getExperimentRuntimeState(context, experimentId);
    expect(experimentAfterNoEffect?.status).toBe(ExperimentStatus.COMPLETED);
    expect(experimentAfterNoEffect?.completion?.outcomeType).toBe(ExperimentOutcomeType.NO_EFFECT);

    const { ownerId: owner2Id, experimentId: experiment2Id } =
      await createRunningExperiment(context);

    const experiment2 = await getExperimentRuntimeState(context, experiment2Id);
    const winner = experiment2?.variants.find((variant) => variant.isControl === false);
    expect(typeof winner?.id).toBe('string');

    const completeWinner = await context.http
      .post(`/experiments/${experiment2Id}/complete`)
      .set('Authorization', authHeaderForUser(owner2Id))
      .send({
        outcomeType: ExperimentOutcomeType.ROLLOUT_WINNER,
        winnerVariantId: winner?.id,
        comment: 'Treatment wins',
      });
    expect(completeWinner.status).toBe(200);
    await waitForExperimentStatus(context, experiment2Id, ExperimentStatus.COMPLETED, owner2Id);

    const experimentAfterWinner = await getExperimentRuntimeState(context, experiment2Id);
    expect(experimentAfterWinner?.status).toBe(ExperimentStatus.COMPLETED);
    expect(experimentAfterWinner?.completion?.outcomeType).toBe(
      ExperimentOutcomeType.ROLLOUT_WINNER,
    );
    expect(experimentAfterWinner?.completion?.winnerVariantId).toBe(winner?.id);
  });

  it('completes paused experiment with ROLLBACK outcome and blocks invalid winner variant id', async () => {
    const { ownerId, experimentId } = await createRunningExperiment(context);
    await materializeExperimentProjectionForFk(context, experimentId);

    const pause = await context.http
      .post(`/experiments/${experimentId}/pause`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(pause.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.PAUSED, ownerId);

    const invalidWinner = await context.http
      .post(`/experiments/${experimentId}/complete`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        outcomeType: ExperimentOutcomeType.ROLLOUT_WINNER,
        winnerVariantId: crypto.randomUUID(),
        comment: 'invalid winner id',
      });
    expect(invalidWinner.status).toBe(409);
    expect(invalidWinner.body.code).toBe('VARIANT_NOT_FOUND');

    const rollback = await context.http
      .post(`/experiments/${experimentId}/complete`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        outcomeType: ExperimentOutcomeType.ROLLBACK,
        comment: 'Guardrail degradation detected',
      });
    expect(rollback.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.COMPLETED, ownerId);

    const experimentAfterRollback = await getExperimentRuntimeState(context, experimentId);
    expect(experimentAfterRollback?.completion?.outcomeType).toBe(ExperimentOutcomeType.ROLLBACK);
  });

  it('archives completed experiment and rejects archive from non-completed status', async () => {
    const { ownerId, experimentId } = await createRunningExperiment(context);

    const archiveWhileRunning = await context.http
      .post(`/experiments/${experimentId}/archive`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(archiveWhileRunning.status).toBe(409);
    expect(archiveWhileRunning.body.code).toBe('INVALID_STATUS_TRANSITION');

    const complete = await context.http
      .post(`/experiments/${experimentId}/complete`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        outcomeType: ExperimentOutcomeType.NO_EFFECT,
        comment: 'Closing experiment before archive',
      });
    expect(complete.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.COMPLETED, ownerId);

    const archive = await context.http
      .post(`/experiments/${experimentId}/archive`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(archive.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.ARCHIVED, ownerId);

    const experimentAfterArchive = await getExperimentRuntimeState(context, experimentId);
    expect(experimentAfterArchive?.status).toBe(ExperimentStatus.ARCHIVED);
  });
});
