import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';

vi.setConfig({ testTimeout: 30000 });

applyMigrations();

describe('edge cases e2e', () => {
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

  it('rejects invalid bearer token on protected endpoints', async () => {
    const response = await context.http
      .get('/users')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(response.status).toBe(401);
  });

  it('keeps runtime decide and ingest endpoints public', async () => {
    const decide = await context.http.post('/decide').send({
      subjectId: `subject-${crypto.randomUUID()}`,
      flagKeys: ['unknown_flag'],
      attributes: {},
    });
    expect(decide.status).toBe(200);

    const ingest = await context.http.post('/events/ingest').send({ events: [] });
    expect(ingest.status).toBe(200);
  });
});
