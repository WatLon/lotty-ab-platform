import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('criteria hardening e2e', () => {
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

  it('allows only approver/admin to approve submitted experiment', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    const viewerId = await createUser(context.http, { role: Role.VIEWER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http);
    const metricId = await createMetricDefinition(context.http, {
      key: `criteria_metric_${crypto.randomUUID().slice(0, 8)}`,
      formula: {
        type: 'COUNT',
        eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.criteria`,
      },
    });

    const created = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        name: `Experiment ${crypto.randomUUID().slice(0, 8)}`,
        description: 'criteria test',
        flagId,
        audiencePercent: 100,
        variants: [
          { name: 'Control', value: 'A', weight: 50, isControl: true },
          { name: 'Treatment', value: 'B', weight: 50, isControl: false },
        ],
        metricIds: [metricId],
        primaryMetricId: metricId,
      });

    expect(created.status).toBe(201);
    const experimentId = created.body.id as string;

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const viewerApprove = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(viewerId))
      .send({ comment: 'viewer approval' });
    expect(viewerApprove.status).toBe(403);

    const approverApprove = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approved' });
    expect(approverApprove.status).toBe(200);
  });

  it('forbids viewer to create experiment', async () => {
    const viewerId = await createUser(context.http, { role: Role.VIEWER });
    const flagId = await createFlag(context.http);

    const createExperiment = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(viewerId))
      .send({
        name: `Viewer experiment ${crypto.randomUUID().slice(0, 8)}`,
        description: 'should be forbidden',
        flagId,
        audiencePercent: 100,
        variants: [
          { name: 'Control', value: 'A', weight: 50, isControl: true },
          { name: 'Treatment', value: 'B', weight: 50, isControl: false },
        ],
      });

    expect(createExperiment.status).toBe(403);
  });

  it('rejects experiment creation when variant weights do not match audience percent', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const flagId = await createFlag(context.http);

    const createExperiment = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        name: `Weight mismatch ${crypto.randomUUID().slice(0, 8)}`,
        description: 'bad weights',
        flagId,
        audiencePercent: 100,
        variants: [
          { name: 'Control', value: 'A', weight: 30, isControl: true },
          { name: 'Treatment', value: 'B', weight: 30, isControl: false },
        ],
      });

    expect(createExperiment.status).toBe(409);
    expect(createExperiment.body.code).toBe('VARIANTS_WEIGHT_MISMATCH');
  });

  it('rejects experiment creation with multiple control variants', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const flagId = await createFlag(context.http);

    const createExperiment = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        name: `Multi control ${crypto.randomUUID().slice(0, 8)}`,
        description: 'invalid controls',
        flagId,
        audiencePercent: 100,
        variants: [
          { name: 'Control A', value: 'A', weight: 50, isControl: true },
          { name: 'Control B', value: 'B', weight: 50, isControl: true },
        ],
      });

    expect(createExperiment.status).toBe(409);
    expect(createExperiment.body.code).toBe('MULTIPLE_CONTROL_VARIANTS');
  });

  it('rejects invalid targeting DSL on create', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const flagId = await createFlag(context.http);

    const createExperiment = await context.http
      .post('/experiments')
      .set('Authorization', authHeaderForUser(ownerId))
      .send({
        name: `Bad targeting ${crypto.randomUUID().slice(0, 8)}`,
        description: 'invalid targeting',
        flagId,
        audiencePercent: 100,
        targetingRule: { and: [] },
        variants: [
          { name: 'Control', value: 'A', weight: 50, isControl: true },
          { name: 'Treatment', value: 'B', weight: 50, isControl: false },
        ],
      });

    expect(createExperiment.status).toBe(400);
  });
});
