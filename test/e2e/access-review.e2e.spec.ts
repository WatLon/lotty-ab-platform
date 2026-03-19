import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { FlagValueType } from '@/apps/control-api/domain/flag';
import { Role } from '@/apps/control-api/domain/user';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createExperiment,
  createFlag,
  createUser,
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

describe('access and review e2e', () => {
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

  it('enforces role access for protected resources', async () => {
    const viewerId = await createUser(context.http, { role: Role.VIEWER });

    const viewerCreateFlag = await context.http
      .post('/flags')
      .set('Authorization', authHeaderForUser(viewerId))
      .send({
        key: `viewer_flag_${crypto.randomUUID().slice(0, 8)}`,
        valueType: FlagValueType.STRING,
        defaultValue: 'A',
      });

    expect(viewerCreateFlag.status).toBe(403);

    const adminAccessToken = await loginAsAdmin(context);
    const adminCreateFlag = await context.http
      .post('/flags')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        key: `admin_flag_${crypto.randomUUID().slice(0, 8)}`,
        valueType: FlagValueType.STRING,
        defaultValue: 'A',
      });

    expect(adminCreateFlag.status).toBe(201);
  });

  it('applies fallback review policy without approver group (admin can approve, threshold=1)', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    const flagId = await createFlag(context.http);

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const approverReview = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approve attempt' });
    expect(approverReview.status).toBe(409);
    expect(approverReview.body.code).toBe('NOT_AUTHORIZED_TO_REVIEW');

    const adminAccessToken = await loginAsAdmin(context);
    const adminReview = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ comment: 'fallback admin approval' });
    expect(adminReview.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.APPROVED, ownerId);
  });

  it('requires requiredApprovals approvals before moving to APPROVED', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverAId = await createUser(context.http, { role: Role.APPROVER });
    const approverBId = await createUser(context.http, { role: Role.APPROVER });

    const groupId = await createApproverGroupWithMember(context.http, {
      ownerId,
      memberId: approverAId,
      requiredApprovals: 2,
    });

    const adminAccessToken = await loginAsAdmin(context);
    const addSecondApprover = await context.http
      .post(`/approver-groups/${groupId}/members`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ userId: approverBId });
    expect(addSecondApprover.status).toBe(201);

    const flagId = await createFlag(context.http);
    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const approveA = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverAId))
      .send({ comment: 'first approval' });
    expect(approveA.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.IN_REVIEW, ownerId);

    const approveB = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverBId))
      .send({ comment: 'second approval' });
    expect(approveB.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.APPROVED, ownerId);
  });

  it('moves experiment back to draft on request-changes and allows resubmission', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverAId = await createUser(context.http, { role: Role.APPROVER });
    const approverBId = await createUser(context.http, { role: Role.APPROVER });
    const groupId = await createApproverGroupWithMember(context.http, {
      ownerId,
      memberId: approverAId,
      requiredApprovals: 1,
    });
    const adminAccessToken = await loginAsAdmin(context);
    const addSecondApprover = await context.http
      .post(`/approver-groups/${groupId}/members`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ userId: approverBId });
    expect(addSecondApprover.status).toBe(201);
    const flagId = await createFlag(context.http);

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.IN_REVIEW, ownerId);

    const requestChanges = await context.http
      .post(`/experiments/${experimentId}/request-changes`)
      .set('Authorization', authHeaderForUser(approverAId))
      .send({ comment: 'lower risk and adjust targeting' });
    expect(requestChanges.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.DRAFT, ownerId);

    const patchDraft = await context.http
      .patch(`/experiments/${experimentId}`)
      .set('Authorization', authHeaderForUser(ownerId))
      .send({ audiencePercent: 100 });
    expect(patchDraft.status).toBe(200);

    const resubmit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(resubmit.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.IN_REVIEW, ownerId);

    const approveAfterChanges = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverBId))
      .send({ comment: 'approved after changes' });
    expect(approveAfterChanges.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.APPROVED, ownerId);
  });

  it('keeps experiment rejected and prevents start until it is reworked', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http);

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const reject = await context.http
      .post(`/experiments/${experimentId}/reject`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'high risk without proper guardrails' });
    expect(reject.status).toBe(200);
    await waitForExperimentStatus(context, experimentId, ExperimentStatus.REJECTED, ownerId);

    const startRejected = await context.http
      .post(`/experiments/${experimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(startRejected.status).toBe(409);
    expect(startRejected.body.code).toBe('INVALID_STATUS_TRANSITION');

    const submitRejected = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submitRejected.status).toBe(409);
    expect(submitRejected.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('prevents duplicate review decision from the same approver', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });
    const flagId = await createFlag(context.http);

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });

    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const approveFirst = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'first decision' });
    expect(approveFirst.status).toBe(200);

    const approveSecond = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'duplicate decision' });
    expect(approveSecond.status).toBe(409);
    expect(approveSecond.body.code).toBe('ALREADY_REVIEWED');
  });

  it('blocks review from approver not in owner approver-group', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const groupApproverId = await createUser(context.http, { role: Role.APPROVER });
    const outsiderApproverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: groupApproverId });
    const flagId = await createFlag(context.http);

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });
    const submit = await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    expect(submit.status).toBe(200);

    const outsiderReview = await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(outsiderApproverId))
      .send({ comment: 'should not be allowed' });
    expect(outsiderReview.status).toBe(409);
    expect(outsiderReview.body.code).toBe('NOT_AUTHORIZED_TO_REVIEW');
  });

  it('returns review history for experiment', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverAId = await createUser(context.http, { role: Role.APPROVER });
    const approverBId = await createUser(context.http, { role: Role.APPROVER });
    const groupId = await createApproverGroupWithMember(context.http, {
      ownerId,
      memberId: approverAId,
      requiredApprovals: 2,
    });
    const adminAccessToken = await loginAsAdmin(context);
    const addSecondApprover = await context.http
      .post(`/approver-groups/${groupId}/members`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ userId: approverBId });
    expect(addSecondApprover.status).toBe(201);
    const flagId = await createFlag(context.http);

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });
    await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    await context.http
      .post(`/experiments/${experimentId}/request-changes`)
      .set('Authorization', authHeaderForUser(approverAId))
      .send({ comment: 'iteration 1' });
    await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverBId))
      .send({ comment: 'iteration 2 approved' });

    const adminAccessToken2 = await loginAsAdmin(context);
    const reviews = await context.http
      .get(`/experiments/${experimentId}/reviews`)
      .set('Authorization', `Bearer ${adminAccessToken2}`)
      .query({ limit: 10, offset: 0 });

    expect(reviews.status).toBe(200);
    expect(Array.isArray(reviews.body.data)).toBe(true);
    expect(reviews.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
