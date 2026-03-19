import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@/apps/control-api/domain/user';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createApproverGroupWithMember,
  createEventType,
  createExperiment,
  createFlag,
  createUser,
  syncEventTypeCatalogById,
  syncRuntimeSnapshotForExperiment,
} from './factories';

applyMigrations();

describe('events ingest contract e2e', () => {
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

  it('B4-5: ingest response should expose duplicates counter', async () => {
    const response = await context.http.post('/events/ingest').send({ events: [] });

    expect(response.status).toBe(200);
    expect(typeof response.body.accepted).toBe('number');
    expect(typeof response.body.rejected).toBe('number');
    expect(typeof response.body.duplicates).toBe('number');
  });

  it('B4-5: duplicate event_ids in one batch should count as duplicates and not accepted twice', async () => {
    const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const approverId = await createUser(context.http, { role: Role.APPROVER });
    await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });

    const flagId = await createFlag(context.http, {
      key: `gap_flag_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });

    const experimentId = await createExperiment(context.http, { actorId: ownerId, flagId });
    await context.http
      .post(`/experiments/${experimentId}/submit`)
      .set('Authorization', authHeaderForUser(ownerId));
    await context.http
      .post(`/experiments/${experimentId}/approve`)
      .set('Authorization', authHeaderForUser(approverId))
      .send({ comment: 'approve' });
    await context.http
      .post(`/experiments/${experimentId}/start`)
      .set('Authorization', authHeaderForUser(ownerId));
    await syncRuntimeSnapshotForExperiment(context, experimentId);

    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.gap`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const subjectId = `gap-subject-${crypto.randomUUID().slice(0, 8)}`;
    const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [flag.key],
    });

    expect(decide.status).toBe(200);
    const decisionId = decide.body.decisions[0]?.decisionId as string;
    const duplicateEventId = `evt-${crypto.randomUUID()}`;

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: duplicateEventId,
          eventTypeKey: eventType.key,
          decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
        {
          eventId: duplicateEventId,
          eventTypeKey: eventType.key,
          decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(1);
    expect(ingest.body.duplicates).toBe(1);
    expect(ingest.body.rejected).toBe(0);
  });
});
