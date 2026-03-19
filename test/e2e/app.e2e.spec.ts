import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlagValueType } from '@/apps/control-api/domain/flag';
import { Role } from '@/apps/control-api/domain/user';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createFlag,
  createMetricDefinition,
  createUser,
} from './factories';

vi.setConfig({ testTimeout: 30000 });

applyMigrations();

async function loginAs(context: E2EContext, email: string, password: string): Promise<string> {
  const response = await context.http.post('/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  expect(typeof response.body.accessToken).toBe('string');
  return response.body.accessToken as string;
}

describe('app e2e', () => {
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

  it('exposes public health and readiness endpoints', async () => {
    const health = await context.http.get('/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });

    const ready = await context.http.get('/ready');
    expect([200, 503]).toContain(ready.status);
  });

  it('requires auth for protected endpoints and supports login', async () => {
    const usersWithoutAuth = await context.http.get('/users');
    expect(usersWithoutAuth.status).toBe(401);

    const adminToken = await loginAs(
      context,
      process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com',
      process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'SecurePass123',
    );

    const createUserResponse = await context.http
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `viewer-${crypto.randomUUID().slice(0, 8)}@example.com`,
        password: 'SecurePass123',
        name: 'Viewer User',
        role: Role.VIEWER,
      });

    expect(createUserResponse.status).toBe(201);
    const viewerId = createUserResponse.body.id as string;

    const viewerListUsers = await context.http
      .get('/users')
      .set('Authorization', authHeaderForUser(viewerId));
    expect(viewerListUsers.status).toBe(403);

    const flagByAdmin = await context.http
      .post('/flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: `flag_${crypto.randomUUID().slice(0, 8)}`,
        valueType: FlagValueType.STRING,
        defaultValue: 'A',
      });
    expect(flagByAdmin.status).toBe(201);
  });

  it('runs experiment lifecycle with authenticated owner and approver', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http);
    const metricId = await createMetricDefinition(context.http, {
      key: `app_metric_${crypto.randomUUID().slice(0, 8)}`,
      formula: {
        type: 'COUNT',
        eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.app`,
      },
    });

    const createExperiment = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        name: `Experiment ${crypto.randomUUID().slice(0, 8)}`,
        description: 'integration test',
        flagId,
        audiencePercent: 100,
        variants: [
          { name: 'Control', value: 'A', weight: 50, isControl: true },
          { name: 'Treatment', value: 'B', weight: 50, isControl: false },
        ],
        metricIds: [metricId],
        primaryMetricId: metricId,
      });

    expect(createExperiment.status).toBe(201);
    const experimentId = createExperiment.body.id as string;

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const approve = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approved' });
    expect(approve.status).toBe(200);

    const start = await context.http
      .post(`/experiments/${experimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(start.status).toBe(200);
  });
});
