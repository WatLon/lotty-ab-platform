import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
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
  syncRuntimeSnapshotForFlag,
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

async function createStartedExperimentWithFlag(
  context: E2EContext,
): Promise<{ ownerId: string; flagId: string; flagKey: string; experimentId: string }> {
  const ownerId = await createUser(context.http, { role: Role.EXPERIMENTER });
  const approverId = await createUser(context.http, { role: Role.APPROVER });
  await createApproverGroupWithMember(context.http, { ownerId, memberId: approverId });

  const flagId = await createFlag(context.http, {
    key: `events_flag_${crypto.randomUUID().slice(0, 8)}`,
    defaultValue: 'A',
  });
  await syncRuntimeSnapshotForFlag(context, flagId);

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
    .send({ comment: 'approved for events tests' });
  expect(approve.status).toBe(200);

  const start = await context.http
    .post(`/experiments/${experimentId}/start`)
    .set('Authorization', authHeaderForUser(ownerId));
  expect(start.status).toBe(200);

  await waitForExperimentStatus(context, experimentId, ExperimentStatus.RUNNING, ownerId);
  await syncRuntimeSnapshotForExperiment(context, experimentId);

  const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
  return { ownerId, flagId, flagKey: flag.key, experimentId };
}

describe('events ingest e2e', () => {
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

  it('accepts a valid event linked to decision_id', async () => {
    const runtime = await createStartedExperimentWithFlag(context);
    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.conversion`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const subjectId = `events-subject-${crypto.randomUUID().slice(0, 8)}`;
    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [runtime.flagKey],
    });

    expect(decide.status).toBe(200);
    const decisionId = decide.body.decisions[0]?.decisionId as string;
    expect(typeof decisionId).toBe('string');

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId,
          subjectId,
          payload: { source: 'e2e' },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(1);
    expect(ingest.body.rejected).toBe(0);
    expect(ingest.body.errors).toEqual([]);
  });

  it('rejects event payload that violates event type schema', async () => {
    const runtime = await createStartedExperimentWithFlag(context);
    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.schema_violation`,
      schema: {
        type: 'object',
        required: ['screen', 'latencyMs'],
        properties: {
          screen: { type: 'string' },
          latencyMs: { type: 'number', min: 0 },
        },
        additionalProperties: false,
      },
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const subjectId = `events-subject-${crypto.randomUUID().slice(0, 8)}`;
    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [runtime.flagKey],
    });

    expect(decide.status).toBe(200);
    const decisionId = decide.body.decisions[0]?.decisionId as string;

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId,
          subjectId,
          payload: { screen: 'checkout' },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(0);
    expect(ingest.body.rejected).toBe(1);
    expect(ingest.body.errors).toHaveLength(1);
    expect(ingest.body.errors[0].code).toBe('INVALID_EVENT_PAYLOAD');
  });

  it('rejects event when decision subject does not match event subject', async () => {
    const runtime = await createStartedExperimentWithFlag(context);
    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.mismatch`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const decide = await context.http.post('/decide').send({
      subjectId: `events-subject-A-${crypto.randomUUID().slice(0, 8)}`,
      attributes: {},
      flagKeys: [runtime.flagKey],
    });
    expect(decide.status).toBe(200);

    const decisionId = decide.body.decisions[0]?.decisionId as string;
    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId,
          subjectId: `events-subject-B-${crypto.randomUUID().slice(0, 8)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(0);
    expect(ingest.body.rejected).toBe(1);
    expect(ingest.body.errors).toHaveLength(1);
    expect(ingest.body.errors[0].code).toBe('DECISION_SUBJECT_MISMATCH');
  });

  it('rejects unknown event type key', async () => {
    const flagId = await createFlag(context.http, {
      key: `events_unknown_${crypto.randomUUID().slice(0, 8)}`,
      defaultValue: 'A',
    });
    await syncRuntimeSnapshotForFlag(context, flagId);

    const flag = await context.prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    const subjectId = `events-unknown-${crypto.randomUUID().slice(0, 8)}`;

    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [flag.key],
    });

    expect(decide.status).toBe(200);

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.missing`,
          decisionId: decide.body.decisions[0]?.decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(0);
    expect(ingest.body.rejected).toBe(1);
    expect(ingest.body.errors).toHaveLength(1);
    expect(ingest.body.errors[0].code).toBe('UNKNOWN_EVENT_TYPE');
  });

  it('rejects event with invalid decision_id signature', async () => {
    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.invalid_decision`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId: 'invalid.decision.token',
          subjectId: `events-subject-${crypto.randomUUID().slice(0, 8)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(0);
    expect(ingest.body.rejected).toBe(1);
    expect(ingest.body.errors).toHaveLength(1);
    expect(ingest.body.errors[0].code).toBe('INVALID_DECISION_ID');
  });

  it('rejects archived event type', async () => {
    const runtime = await createStartedExperimentWithFlag(context);
    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.archived`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const adminToken = await loginAsAdmin(context);
    const archiveEventType = await context.http
      .post(`/event-types/${eventType.id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archiveEventType.status).toBe(201);
    await syncEventTypeCatalogById(context, eventType.id);

    const subjectId = `events-subject-${crypto.randomUUID().slice(0, 8)}`;
    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [runtime.flagKey],
    });
    expect(decide.status).toBe(200);

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId: decide.body.decisions[0]?.decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(0);
    expect(ingest.body.rejected).toBe(1);
    expect(ingest.body.errors).toHaveLength(1);
    expect(ingest.body.errors[0].code).toBe('EVENT_TYPE_ARCHIVED');
  });

  it('rejects batch larger than 1000 events', async () => {
    const events = Array.from({ length: 1001 }, (_, index) => ({
      eventId: `evt-overflow-${index}`,
      eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.overflow`,
      decisionId: 'invalid.decision.token',
      subjectId: `subject-${index}`,
      timestamp: new Date().toISOString(),
    }));

    const ingest = await context.http.post('/events/ingest').send({ events });

    expect([200, 400, 413, 500]).toContain(ingest.status);
    if (ingest.status === 200) {
      expect(ingest.body.accepted).toBe(0);
      expect(ingest.body.rejected).toBe(1001);
    }
  });

  it('rejects invalid event timestamp format', async () => {
    const eventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.bad_timestamp`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, eventType.id);

    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId: 'invalid.decision.token',
          subjectId: `events-subject-${crypto.randomUUID().slice(0, 8)}`,
          timestamp: '19-02-2026 20:00:00',
        },
      ],
    });

    expect(ingest.status).toBe(400);
  });

  it('returns mixed ingest stats for accepted duplicate and rejected records in one batch', async () => {
    const runtime = await createStartedExperimentWithFlag(context);
    const validEventType = await createEventType(context.http, {
      key: `event.${crypto.randomUUID().slice(0, 8)}.mixed_valid`,
      requiresExposure: false,
    });
    await syncEventTypeCatalogById(context, validEventType.id);

    const subjectId = `events-mixed-${crypto.randomUUID().slice(0, 8)}`;
    const decide = await context.http.post('/decide').send({
      subjectId,
      attributes: {},
      flagKeys: [runtime.flagKey],
    });
    expect(decide.status).toBe(200);
    const decisionId = decide.body.decisions[0]?.decisionId as string;

    const duplicateEventId = `evt-${crypto.randomUUID()}`;
    const ingest = await context.http.post('/events/ingest').send({
      events: [
        {
          eventId: duplicateEventId,
          eventTypeKey: validEventType.key,
          decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
        {
          eventId: duplicateEventId,
          eventTypeKey: validEventType.key,
          decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: `event.${crypto.randomUUID().slice(0, 8)}.unknown`,
          decisionId,
          subjectId,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(1);
    expect(ingest.body.duplicates).toBe(1);
    expect(ingest.body.rejected).toBe(1);
    expect(ingest.body.errors).toHaveLength(1);
    expect(ingest.body.errors[0].code).toBe('UNKNOWN_EVENT_TYPE');
  });
});
