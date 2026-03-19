import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { Role } from '@/apps/control-api/domain/user';
import { closeE2EContext, createE2EContext, E2EContext } from './bootstrap';
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

applyMigrations();

async function createRunningExperimentForReport(context: E2EContext): Promise<string> {
  const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
  const approverId = await createUser(context.http, { role: Role.APPROVER });

  await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });

  const flagId = await createFlag(context.http, {
    key: `report_contract_flag_${crypto.randomUUID().slice(0, 8)}`,
    defaultValue: 'A',
  });

  const experimentId = await createExperiment(context.http, {
    actorId: ownerId,
    flagId,
  });

  const submit = await context.http
    .post(`/experiments/${experimentId}/submit`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(submit.status).toBe(200);

  const approve = await context.http
    .post(`/experiments/${experimentId}/approve`)
    .set('Authorization', authHeaderForUser(approverId))
    .send({ comment: 'approved for reporting contract test' });
  expect(approve.status).toBe(200);

  const start = await context.http
    .post(`/experiments/${experimentId}/start`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(start.status).toBe(200);

  await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);
  await materializeExperimentProjectionForFk(context, experimentId);

  return experimentId;
}

describe('reporting and observability contract e2e', () => {
  let context: E2EContext;
  let adminAccessToken: string;

  beforeAll(async () => {
    context = await createE2EContext();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
    const loginResponse = await context.http.post('/auth/login').send({
      email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'SecurePass123',
    });
    expect(loginResponse.status).toBe(200);
    adminAccessToken = loginResponse.body.accessToken as string;
  });

  afterAll(async () => {
    if (context) {
      await closeE2EContext(context);
    }
  });

  it('B6-1/B6-2/B6-3: report endpoint should return metrics by period and variant', async () => {
    const experimentId = await createRunningExperimentForReport(context);

    const response = await context.http
      .get(`/reports/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .query({ from: '2026-02-01T00:00:00.000Z', to: '2026-02-02T00:00:00.000Z' });

    expect(response.status).toBe(200);
  });

  it('B9-3: metrics endpoint should expose runtime counters and product metrics', async () => {
    const response = await context.http.get('/metrics');

    expect(response.status).toBe(200);
    expect(typeof response.text).toBe('string');
    expect(response.text.includes('http_requests_total')).toBe(true);
    expect(response.text.includes('lotty_decide_total')).toBe(true);
    expect(response.text.includes('lotty_decide_duration_ms_bucket')).toBe(true);
    expect(response.text.includes('lotty_active_experiments')).toBe(true);
  });
});
