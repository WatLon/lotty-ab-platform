import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
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
  return response.body.accessToken as string;
}
describe('catalog admin policies e2e', () => {
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
  it('supports typed flag lifecycle and rejects invalid default value update', async () => {
    const adminToken = await loginAsAdmin(context);
    const create = await context.http
      .post('/flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: `bool_flag_${crypto.randomUUID().slice(0, 8)}`,
        valueType: 'BOOLEAN',
        defaultValue: 'true',
      });
    expect(create.status).toBe(201);
    const flagId = create.body.id as string;
    const updateOk = await context.http
      .patch(`/flags/${flagId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ defaultValue: 'false' });
    expect(updateOk.status).toBe(200);
    const updateInvalid = await context.http
      .patch(`/flags/${flagId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ defaultValue: 'not-a-bool' });
    expect(updateInvalid.status).toBe(400);
  });
  it('forbids non-admin users to manage event types', async () => {
    const viewerId = await createUser(context.http, { role: Role.VIEWER });
    const createEventType = await context.http
      .post('/event-types')
      .set('Authorization', authHeaderForUser(viewerId))
      .send({
        key: `event.${crypto.randomUUID().slice(0, 8)}.viewer`,
        name: 'Viewer Event',
        requiresExposure: false,
      });
    expect(createEventType.status).toBe(403);
  });
  it('prevents metric archive when metric is used by active guardrail', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http, {
      key: `metric_guardrail_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    const metricId = await createMetricDefinition(context.http, {
      key: `metric_${crypto.randomUUID().slice(0, 8)}_protected`,
      formula: {
        type: 'COUNT',
        eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.errors`,
      },
    });
    const experimentId = await createExperiment(context.http, {
      actorId: ownerId,
      flagId,
      autoAttachPrimaryMetric: false,
      metricIds: [metricId],
      primaryMetricId: metricId,
    });
    await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approved for metric archive guardrail test' });
    await context.http
      .post(`/experiments/${experimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);
    await materializeExperimentProjectionForFk(context, experimentId);
    await context.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: ExperimentStatus.RUNNING },
    });
    const attachGuardrail = await context.http
      .post(`/experiments/${experimentId}/guardrails`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        metricId,
        threshold: 1,
        operator: 'GT',
        windowMinutes: 10,
        action: 'PAUSE',
      });
    expect(attachGuardrail.status).toBe(201);
    const adminToken = await loginAsAdmin(context);
    const archiveMetric = await context.http
      .post(`/metric-definitions/${metricId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archiveMetric.status).toBe(409);
    expect(archiveMetric.body.code).toBe('METRIC_IN_USE_BY_ACTIVE_GUARDRAILS');
  });
});
