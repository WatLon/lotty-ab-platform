import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DecisionReason } from '@/apps/decide-api/domain';
import { InMemoryRuntimeSnapshotProvider } from '@/apps/decide-api/infrastructure/runtime-snapshot.provider';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';

applyMigrations();
describe('observability and readiness e2e', () => {
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
  it('exposes health and readiness endpoints with diagnostic payload', async () => {
    const health = await context.http.get('/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    const ready = await context.http.get('/ready');
    expect([200, 503]).toContain(ready.status);
    if (ready.status === 200) {
      expect(ready.body.status).toBe('ok');
      expect(typeof ready.body.components).toBe('object');
    } else {
      expect(ready.body.message?.status).toBe('degraded');
      expect(typeof ready.body.message?.components).toBe('object');
    }
  });
  it('exposes prometheus metrics including runtime counters', async () => {
    const decide = await context.http.post('/decide').send({
      subjectId: `metrics-${crypto.randomUUID().slice(0, 8)}`,
      attributes: {},
      flagKeys: [`metrics_flag_${crypto.randomUUID().slice(0, 8)}`],
    });
    expect(decide.status).toBe(200);
    const ingest = await context.http.post('/events/ingest').send({ events: [] });
    expect(ingest.status).toBe(200);
    const metrics = await context.http.get('/metrics');
    expect(metrics.status).toBe(200);
    expect(typeof metrics.text).toBe('string');
    expect(metrics.text.includes('http_requests_total')).toBe(true);
    expect(metrics.text.includes('lotty_decide_total')).toBe(true);
    expect(metrics.text.includes('lotty_ingest_total')).toBe(true);
    expect(metrics.text.includes('lotty_decide_duration_ms_bucket')).toBe(true);
    expect(metrics.text.includes('lotty_active_experiments')).toBe(true);
  });
  it('returns SNAPSHOT_NOT_READY decisions when runtime snapshot provider is not ready', async () => {
    const runtimeSnapshot = context.app.get(InMemoryRuntimeSnapshotProvider, {
      strict: false,
    });
    runtimeSnapshot.reset();
    const decide = await context.http.post('/decide').send({
      subjectId: `snapshot-not-ready-${crypto.randomUUID().slice(0, 8)}`,
      attributes: {},
      flagKeys: ['flag_a', 'flag_b'],
    });
    expect(decide.status).toBe(200);
    expect(Array.isArray(decide.body.decisions)).toBe(true);
    expect(decide.body.decisions.length).toBe(2);
    expect(decide.body.decisions[0]?.reason).toBe(DecisionReason.SNAPSHOT_NOT_READY);
    expect(decide.body.decisions[1]?.reason).toBe(DecisionReason.SNAPSHOT_NOT_READY);
  });
});
