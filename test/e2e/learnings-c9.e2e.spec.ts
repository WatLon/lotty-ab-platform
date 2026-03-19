import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/apps/control-api/domain/user';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';
import {
  authHeaderForUser,
  createExperiment,
  createFlag,
  createUser,
  materializeExperimentProjectionForFk,
} from './factories';

vi.setConfig({ testTimeout: 30000 });

applyMigrations();

interface CreateLearningPayload {
  experimentId?: string | null;
  featureKey?: string | null;
  team?: string | null;
  title: string;
  hypothesis: string;
  primaryMetricKey: string;
  guardrailMetricKeys?: string[];
  result?: 'ROLLOUT_WINNER' | 'ROLLBACK' | 'NO_EFFECT' | null;
  actionTaken: string;
  summary: string;
  notes?: string | null;
  tags?: string[];
  countries?: string[];
  platforms?: string[];
  reportUrl?: string | null;
  ticketUrl?: string | null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createLearning(
  context: E2EContext,
  actorId: string,
  payload: CreateLearningPayload,
): Promise<string> {
  const response = await context.http
    .post('/learnings')
    .set('Authorization', authHeaderForUser(actorId))
    .send(payload);

  if (response.status !== 201 || typeof response.body.id !== 'string') {
    throw new Error(`createLearning failed: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return response.body.id as string;
}

describe('learnings c9 e2e', () => {
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

  it('supports create/update/archive flow with revision audit and role restrictions', async () => {
    const experimenterId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const viewerId = await createUser(context.http, { role: Role.VIEWER });

    const flagId = await createFlag(context.http, {
      key: `learn_flag_${crypto.randomUUID().slice(0, 8)}`,
    });
    const experimentId = await createExperiment(context.http, {
      actorId: experimenterId,
      flagId,
      name: `Learnings experiment ${crypto.randomUUID().slice(0, 8)}`,
    });

    const deniedCreate = await context.http
      .post('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .send({
        title: 'Viewer must not create',
        hypothesis: 'forbidden create',
        primaryMetricKey: 'ctr',
        actionTaken: 'none',
        summary: 'forbidden',
      });
    expect(deniedCreate.status).toBe(403);

    const learningId = await createLearning(context, experimenterId, {
      experimentId,
      featureKey: 'checkout_button_color',
      team: 'growth',
      title: `Checkout color learning ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'Blue CTA should improve purchase conversion on checkout',
      primaryMetricKey: 'purchase_conversion',
      guardrailMetricKeys: ['error_rate', 'p95_latency'],
      result: 'ROLLOUT_WINNER',
      actionTaken: 'rollout',
      summary: 'Blue button won with stable guardrails',
      notes: 'stable for iOS/US cohort',
      tags: ['checkout', 'ui'],
      countries: ['US'],
      platforms: ['ios'],
      reportUrl: 'https://example.com/reports/checkout-blue',
      ticketUrl: 'https://example.com/tickets/ab-123',
    });

    const getCreated = await context.http
      .get(`/learnings/${learningId}`)
      .set('Authorization', authHeaderForUser(viewerId));
    expect(getCreated.status).toBe(200);
    expect(getCreated.body.id).toBe(learningId);
    expect(getCreated.body.experimentId).toBe(experimentId);
    expect(Array.isArray(getCreated.body.revisions)).toBe(true);
    expect(getCreated.body.revisions.length).toBe(1);
    expect(getCreated.body.revisions[0]?.revision).toBe(1);

    const update = await context.http
      .patch(`/learnings/${learningId}`)
      .set('Authorization', authHeaderForUser(experimenterId))
      .send({
        result: 'NO_EFFECT',
        actionTaken: 'rollback',
        summary: 'Effect was not stable on extended window',
        notes: 'moved to follow-up iteration',
        tags: ['checkout', 'ui', 'followup'],
      });
    expect(update.status).toBe(200);

    const getUpdated = await context.http
      .get(`/learnings/${learningId}`)
      .set('Authorization', authHeaderForUser(viewerId));
    expect(getUpdated.status).toBe(200);
    expect(getUpdated.body.result).toBe('NO_EFFECT');
    expect(getUpdated.body.actionTaken).toBe('rollback');
    expect(getUpdated.body.summary).toBe('Effect was not stable on extended window');
    expect(Array.isArray(getUpdated.body.revisions)).toBe(true);
    expect(getUpdated.body.revisions.length).toBe(2);
    expect(getUpdated.body.revisions[0]?.revision).toBe(2);
    expect(getUpdated.body.revisions[1]?.revision).toBe(1);
    expect(getUpdated.body.revisions[0]?.changedById).toBe(experimenterId);
    expect(typeof getUpdated.body.revisions[0]?.changedAt).toBe('string');
    expect(getUpdated.body.revisions[1]?.changedById).toBe(experimenterId);
    expect(typeof getUpdated.body.revisions[1]?.changedAt).toBe('string');

    const archive = await context.http
      .post(`/learnings/${learningId}/archive`)
      .set('Authorization', authHeaderForUser(experimenterId));
    expect(archive.status).toBe(201);

    const listDefault = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ q: 'Checkout color learning', limit: 20, offset: 0 });
    expect(listDefault.status).toBe(200);
    expect(
      (listDefault.body.data as Array<Record<string, unknown>>).some(
        (entry) => entry.id === learningId,
      ),
    ).toBe(false);

    const listWithArchived = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ includeArchived: 'true', q: 'Checkout color learning', limit: 20, offset: 0 });
    expect(listWithArchived.status).toBe(200);
    const archivedEntry = (listWithArchived.body.data as Array<Record<string, unknown>>).find(
      (entry) => entry.id === learningId,
    );
    expect(archivedEntry).toBeDefined();
    expect(archivedEntry?.isArchived).toBe(true);
  });

  it('supports full-text search and extended filters by team, experiment and created range', async () => {
    const experimenterId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const viewerId = await createUser(context.http, { role: Role.VIEWER });

    const flagId = await createFlag(context.http, {
      key: `learn_search_flag_${crypto.randomUUID().slice(0, 8)}`,
    });
    const experimentId = await createExperiment(context.http, {
      actorId: experimenterId,
      flagId,
      name: `Learning search experiment ${crypto.randomUUID().slice(0, 8)}`,
    });

    const firstLearningId = await createLearning(context, experimenterId, {
      experimentId,
      featureKey: 'checkout_search',
      team: 'growth',
      title: `Search by title ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'checkout hypothesis token alpha',
      primaryMetricKey: 'purchase_conversion',
      actionTaken: 'rollout',
      summary: 'searchable summary value',
      notes: 'searchable-notes-token',
      tags: ['tag-search-token', 'checkout'],
      countries: ['US'],
      platforms: ['ios'],
      result: 'ROLLOUT_WINNER',
    });
    await sleep(20);
    const pivotIso = new Date().toISOString();
    await sleep(20);

    await createLearning(context, experimenterId, {
      featureKey: 'home_feed',
      team: 'core',
      title: `Second learning ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'different hypothesis',
      primaryMetricKey: 'ctr',
      actionTaken: 'rollback',
      summary: 'different summary',
      notes: 'different-notes-token',
      tags: ['home'],
      countries: ['DE'],
      platforms: ['android'],
      result: 'ROLLBACK',
    });

    const byTitle = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ q: 'Search by title', limit: 20, offset: 0 });
    expect(byTitle.status).toBe(200);
    expect(
      (byTitle.body.data as Array<Record<string, unknown>>).some(
        (item) => item.id === firstLearningId,
      ),
    ).toBe(true);

    const byHypothesis = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ q: 'token alpha', limit: 20, offset: 0 });
    expect(byHypothesis.status).toBe(200);
    expect(
      (byHypothesis.body.data as Array<Record<string, unknown>>).some(
        (item) => item.id === firstLearningId,
      ),
    ).toBe(true);

    const byNotes = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ q: 'searchable-notes-token', limit: 20, offset: 0 });
    expect(byNotes.status).toBe(200);
    expect(
      (byNotes.body.data as Array<Record<string, unknown>>).some(
        (item) => item.id === firstLearningId,
      ),
    ).toBe(true);

    const byTags = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ q: 'tag-search-token', limit: 20, offset: 0 });
    expect(byTags.status).toBe(200);
    expect(
      (byTags.body.data as Array<Record<string, unknown>>).some(
        (item) => item.id === firstLearningId,
      ),
    ).toBe(true);

    const byTeamAndExperiment = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ team: 'growth', experimentId, limit: 20, offset: 0 });
    expect(byTeamAndExperiment.status).toBe(200);
    expect((byTeamAndExperiment.body.data as Array<Record<string, unknown>>).length).toBe(1);
    expect((byTeamAndExperiment.body.data as Array<Record<string, unknown>>)[0]?.id).toBe(
      firstLearningId,
    );

    const beforePivot = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ createdTo: pivotIso, limit: 20, offset: 0 });
    expect(beforePivot.status).toBe(200);
    expect(
      (beforePivot.body.data as Array<Record<string, unknown>>).some(
        (item) => item.id === firstLearningId,
      ),
    ).toBe(true);
    expect((beforePivot.body.data as Array<Record<string, unknown>>).length).toBe(1);

    const afterPivot = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ createdFrom: pivotIso, limit: 20, offset: 0 });
    expect(afterPivot.status).toBe(200);
    expect(
      (afterPivot.body.data as Array<Record<string, unknown>>).some(
        (item) => item.id === firstLearningId,
      ),
    ).toBe(false);
  });

  it('supports filters and similar search by learningId', async () => {
    const experimenterId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const viewerId = await createUser(context.http, { role: Role.VIEWER });

    const baseId = await createLearning(context, experimenterId, {
      featureKey: 'checkout_button_color',
      team: 'growth',
      title: `Base checkout learning ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'Blue color improves checkout completion',
      primaryMetricKey: 'purchase_conversion',
      guardrailMetricKeys: ['error_rate'],
      result: 'ROLLOUT_WINNER',
      actionTaken: 'rollout',
      summary: 'base record for similarity',
      tags: ['checkout', 'ui'],
      countries: ['US'],
      platforms: ['ios'],
    });

    const similarId = await createLearning(context, experimenterId, {
      featureKey: 'checkout_button_color',
      team: 'growth',
      title: `Similar checkout learning ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'CTA text with same color can improve conversion',
      primaryMetricKey: 'purchase_conversion',
      guardrailMetricKeys: ['error_rate'],
      result: 'ROLLOUT_WINNER',
      actionTaken: 'rollout',
      summary: 'similar record',
      tags: ['checkout', 'copy'],
      countries: ['US'],
      platforms: ['ios'],
    });

    await createLearning(context, experimenterId, {
      featureKey: 'search_ranking',
      team: 'search',
      title: `Unrelated learning ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'Ranking tweak affects engagement',
      primaryMetricKey: 'ctr',
      actionTaken: 'rollback',
      summary: 'not related',
      tags: ['search'],
      countries: ['DE'],
      platforms: ['android'],
      result: 'ROLLBACK',
    });

    const filteredList = await context.http
      .get('/learnings')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({
        featureKey: 'checkout_button_color',
        countries: 'US',
        platforms: 'ios',
        result: 'ROLLOUT_WINNER',
        limit: 20,
        offset: 0,
      });
    expect(filteredList.status).toBe(200);
    expect((filteredList.body.data as Array<Record<string, unknown>>).length).toBe(2);

    const similar = await context.http
      .get('/learnings/similar')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ learningId: baseId, limit: 5 });
    expect(similar.status).toBe(200);
    expect(Array.isArray(similar.body)).toBe(true);
    expect(
      (similar.body as Array<{ learning: { id: string } }>).some(
        (item) => item.learning.id === similarId,
      ),
    ).toBe(true);
    expect(
      (similar.body as Array<{ learning: { id: string } }>).some(
        (item) => item.learning.id === baseId,
      ),
    ).toBe(false);

    const archive = await context.http
      .post(`/learnings/${similarId}/archive`)
      .set('Authorization', authHeaderForUser(experimenterId));
    expect(archive.status).toBe(201);

    const similarAfterArchive = await context.http
      .get('/learnings/similar')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ learningId: baseId, limit: 5 });
    expect(similarAfterArchive.status).toBe(200);
    expect(
      (similarAfterArchive.body as Array<{ learning: { id: string } }>).some(
        (item) => item.learning.id === similarId,
      ),
    ).toBe(false);
  });

  it('finds similar learnings by experimentId profile', async () => {
    const experimenterId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const viewerId = await createUser(context.http, { role: Role.VIEWER });

    const featureKey = `checkout_flag_${crypto.randomUUID().slice(0, 8)}`;
    const flagId = await createFlag(context.http, { key: featureKey });
    const experimentId = await createExperiment(context.http, {
      actorId: experimenterId,
      flagId,
      conflictDomain: 'checkout',
      name: `Experiment profile ${crypto.randomUUID().slice(0, 8)}`,
    });
    await materializeExperimentProjectionForFk(context, experimentId);

    const matchedLearningId = await createLearning(context, experimenterId, {
      experimentId,
      featureKey,
      team: experimenterId,
      title: `Experiment matched learning ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'Keep learning tied to experiment profile',
      primaryMetricKey: 'purchase_conversion',
      actionTaken: 'rollout',
      summary: 'matched entry for experiment profile',
      tags: ['checkout'],
      countries: ['US'],
      platforms: ['ios'],
      result: 'ROLLOUT_WINNER',
    });

    await createLearning(context, experimenterId, {
      featureKey: 'home_feed',
      team: 'core',
      title: `Unrelated experiment profile entry ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'Unrelated domain',
      primaryMetricKey: 'dau',
      actionTaken: 'rollback',
      summary: 'unrelated profile',
      tags: ['home'],
      countries: ['BR'],
      platforms: ['web'],
      result: 'ROLLBACK',
    });

    const similar = await context.http
      .get('/learnings/similar')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ experimentId, limit: 5 });
    expect(similar.status).toBe(200);
    expect(Array.isArray(similar.body)).toBe(true);
    expect((similar.body as Array<unknown>).length).toBeGreaterThan(0);

    const matched = (similar.body as Array<{ learning: { id: string }; reasons: string[] }>).find(
      (item) => item.learning.id === matchedLearningId,
    );
    expect(matched).toBeDefined();
    expect(matched?.reasons.includes('same_experiment')).toBe(true);
  });

  it('returns rich similarity reasons for overlapping feature, team, metric and context', async () => {
    const experimenterId = await createUser(context.http, { role: Role.EXPERIMENTER });
    const viewerId = await createUser(context.http, { role: Role.VIEWER });

    const baseId = await createLearning(context, experimenterId, {
      featureKey: 'ranking_search',
      team: 'search',
      title: `Base similarity ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'ranking tuning',
      primaryMetricKey: 'ctr',
      guardrailMetricKeys: ['p95_latency', 'error_rate'],
      result: 'NO_EFFECT',
      actionTaken: 'iterate',
      summary: 'base similarity profile',
      tags: ['search', 'latency-sensitive'],
      countries: ['US', 'CA'],
      platforms: ['ios', 'web'],
    });

    const candidateId = await createLearning(context, experimenterId, {
      featureKey: 'ranking_search',
      team: 'search',
      title: `Candidate similarity ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'same domain and metrics',
      primaryMetricKey: 'ctr',
      guardrailMetricKeys: ['p95_latency'],
      result: 'NO_EFFECT',
      actionTaken: 'rollback',
      summary: 'candidate overlap profile',
      tags: ['search'],
      countries: ['US'],
      platforms: ['web'],
    });

    await createLearning(context, experimenterId, {
      featureKey: 'pricing',
      team: 'growth',
      title: `Unrelated similarity ${crypto.randomUUID().slice(0, 6)}`,
      hypothesis: 'unrelated',
      primaryMetricKey: 'purchase_conversion',
      actionTaken: 'rollback',
      summary: 'unrelated record',
      tags: ['pricing'],
      countries: ['DE'],
      platforms: ['android'],
      result: 'ROLLBACK',
    });

    const similar = await context.http
      .get('/learnings/similar')
      .set('Authorization', authHeaderForUser(viewerId))
      .query({ learningId: baseId, limit: 5 });
    expect(similar.status).toBe(200);
    expect(Array.isArray(similar.body)).toBe(true);

    const candidate = (similar.body as Array<{ learning: { id: string }; reasons: string[] }>).find(
      (item) => item.learning.id === candidateId,
    );
    expect(candidate).toBeDefined();
    expect(candidate?.reasons.includes('same_feature_key')).toBe(true);
    expect(candidate?.reasons.includes('same_team_or_owner')).toBe(true);
    expect(candidate?.reasons.includes('same_primary_metric')).toBe(true);
    expect(candidate?.reasons.includes('same_result')).toBe(true);
    expect(candidate?.reasons.some((reason) => reason.startsWith('guardrail_overlap:'))).toBe(true);
    expect(candidate?.reasons.some((reason) => reason.startsWith('tags_overlap:'))).toBe(true);
    expect(candidate?.reasons.some((reason) => reason.startsWith('platforms_overlap:'))).toBe(true);
    expect(candidate?.reasons.some((reason) => reason.startsWith('countries_overlap:'))).toBe(true);
  });
});
