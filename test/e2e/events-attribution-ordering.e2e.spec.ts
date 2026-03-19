import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { closeE2EContext, createE2EContext, E2EContext, resetE2ETestDoubles } from './bootstrap';
import { applyMigrations, resetDatabase } from './db';

vi.setConfig({ testTimeout: 30000 });
applyMigrations();
type AttributedEventMessage = {
  eventTypeKey: string;
  decisionId: string;
  attributed: number;
};
type MetricObservationMessage = {
  experimentId: string;
  variantId: string;
  metricKey: string;
  value: number;
};
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForRedisKey(
  redis: {
    exists: (key: string) => Promise<number>;
  },
  key: string,
): Promise<boolean> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const exists = await redis.exists(key);
    if (exists > 0) {
      return true;
    }
    await sleep(50);
  }
  return false;
}
type CapturedKafkaMessage = {
  topic: string;
  value: unknown;
};
type KafkaCapture = {
  messages: CapturedKafkaMessage[];
  stop: () => Promise<void>;
};
async function startKafkaCapture(kafka: KafkaService): Promise<KafkaCapture> {
  const consumer = await kafka.createConsumer(`e2e-events-attribution-${crypto.randomUUID()}`);
  await consumer.subscribe({
    topic: KAFKA_TOPICS.EVENTS_ATTRIBUTED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: KAFKA_TOPICS.METRIC_OBSERVATIONS,
    fromBeginning: false,
  });
  let groupJoined = false;
  const groupJoinPromise = new Promise<void>((resolve) => {
    consumer.on(consumer.events.GROUP_JOIN, () => {
      if (groupJoined) {
        return;
      }
      groupJoined = true;
      resolve();
    });
  });

  let stopping = false;
  let stopped = false;
  let unexpectedError: unknown = null;
  const removeCrashListener = consumer.on(consumer.events.CRASH, (event) => {
    if (stopping || unexpectedError) return;
    const crashError = (event as { payload?: { error?: unknown } })?.payload?.error;
    unexpectedError = crashError ?? new Error('Kafka test consumer crashed');
  });

  const messages: CapturedKafkaMessage[] = [];
  const runPromise = consumer
    .run({
      eachMessage: async ({ topic, message }) => {
        const rawValue = message.value?.toString('utf8') ?? 'null';
        let parsedValue: unknown = rawValue;
        try {
          parsedValue = JSON.parse(rawValue);
        } catch {
          parsedValue = rawValue;
        }
        messages.push({
          topic,
          value: parsedValue,
        });
      },
    })
    .catch((error: unknown) => {
      if (!stopping && !unexpectedError) {
        unexpectedError = error;
      }
    });

  await runPromise;
  if (unexpectedError) {
    removeCrashListener();
    throw unexpectedError;
  }

  await Promise.race([groupJoinPromise, sleep(750)]);
  return {
    messages,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      stopping = true;

      removeCrashListener();

      await consumer.stop().catch(() => undefined);
      await consumer.disconnect().catch(() => undefined);
      await runPromise.catch(() => undefined);

      if (unexpectedError) {
        throw unexpectedError;
      }
    },
  };
}
async function waitForAttributedEvents(
  capture: KafkaCapture,
  decisionId: string,
  expectedCount: number,
): Promise<AttributedEventMessage[]> {
  const deadline = Date.now() + 15000;
  let rows: AttributedEventMessage[] = [];
  while (Date.now() < deadline) {
    rows = capture.messages
      .filter((item) => item.topic === KAFKA_TOPICS.EVENTS_ATTRIBUTED)
      .map((item) => item.value as AttributedEventMessage)
      .filter((item) => item.decisionId === decisionId);
    if (rows.length >= expectedCount) {
      return rows;
    }
    await sleep(100);
  }
  return rows;
}
async function waitForMetricObservations(
  capture: KafkaCapture,
  experimentId: string,
  variantId: string,
  expectedTotal: number,
): Promise<MetricObservationMessage[]> {
  const deadline = Date.now() + 15000;
  let rows: MetricObservationMessage[] = [];
  while (Date.now() < deadline) {
    rows = capture.messages
      .filter((item) => item.topic === KAFKA_TOPICS.METRIC_OBSERVATIONS)
      .map((item) => item.value as MetricObservationMessage)
      .filter((item) => item.experimentId === experimentId && item.variantId === variantId);
    const total = rows.reduce((sum, row) => sum + Number(row.value), 0);
    if (total >= expectedTotal) {
      return rows;
    }
    await sleep(100);
  }
  return rows;
}
describe('events attribution ordering e2e', () => {
  let context: E2EContext;
  let redisProvider: RedisClientProvider;
  let kafkaService: KafkaService;
  let capture: KafkaCapture;
  beforeAll(async () => {
    context = await createE2EContext();
    redisProvider = context.app.get(RedisClientProvider);
    kafkaService = context.app.get(KafkaService);
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
    await resetE2ETestDoubles(context);
    capture = await startKafkaCapture(kafkaService);
  });
  afterEach(async () => {
    if (!capture) {
      return;
    }
    await capture.stop();
  });
  afterAll(async () => {
    if (context) {
      await closeE2EContext(context);
    }
  });
  async function publishNormalizedBatch(
    decisionId: string,
    events: Array<{
      id: string;
      eventId: string;
      eventTypeKey: string;
      eventTypeId: string;
      subjectId: string;
      experimentId: string;
      variantId: string;
      payload: Record<string, unknown>;
      timestampIso: string;
      receivedAtIso: string;
      requiresExposure: boolean;
      attributed: boolean;
    }>,
  ): Promise<void> {
    await kafkaService.publish({
      topic: KAFKA_TOPICS.EVENTS_NORMALIZED,
      key: decisionId,
      value: {
        batchId: crypto.randomUUID(),
        events: events.map((event) => ({ ...event, decisionId })),
      },
    });
  }
  it('attributes conversion when exposure arrives later (out-of-order)', async () => {
    const subjectId = `subject-${crypto.randomUUID().slice(0, 8)}`;
    const experimentId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-${crypto.randomUUID().slice(0, 8)}`;
    const decisionId = `decision-${crypto.randomUUID()}`;
    await publishNormalizedBatch(decisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-conv-${crypto.randomUUID()}`,
        eventTypeKey: 'conversion',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'convert' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: true,
        attributed: false,
      },
    ]);
    await sleep(250);
    const beforeExposureRows = await waitForAttributedEvents(capture, decisionId, 0);
    expect(beforeExposureRows).toHaveLength(0);
    await publishNormalizedBatch(decisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-exposure-${crypto.randomUUID()}`,
        eventTypeKey: 'exposure',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'show' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: false,
        attributed: true,
      },
    ]);
    const rows = await waitForAttributedEvents(capture, decisionId, 2);
    expect(rows).toHaveLength(2);
    const observations = await waitForMetricObservations(capture, experimentId, variantId, 2);
    expect(observations.reduce((sum, row) => sum + Number(row.value), 0)).toBe(2);
    const conversion = rows.find((row) => row.eventTypeKey === 'conversion');
    const exposure = rows.find((row) => row.eventTypeKey === 'exposure');
    expect(exposure?.attributed).toBe(1);
    expect(conversion?.attributed).toBe(1);
  });
  it('does not attribute pending conversion after simulated ttl expiration', async () => {
    const subjectId = `subject-${crypto.randomUUID().slice(0, 8)}`;
    const experimentId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-${crypto.randomUUID().slice(0, 8)}`;
    const decisionId = `decision-${crypto.randomUUID()}`;
    await publishNormalizedBatch(decisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-conv-${crypto.randomUUID()}`,
        eventTypeKey: 'conversion',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'convert' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: true,
        attributed: false,
      },
    ]);
    const pendingKey = `attr:pending:${decisionId}`;
    const redis = redisProvider.getClient() as unknown as {
      exists: (key: string) => Promise<number>;
      del: (...keys: string[]) => Promise<number>;
    };
    await waitForRedisKey(redis, pendingKey);
    await redis.del(pendingKey);
    await publishNormalizedBatch(decisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-exposure-${crypto.randomUUID()}`,
        eventTypeKey: 'exposure',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'show' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: false,
        attributed: true,
      },
    ]);
    const rows = await waitForAttributedEvents(capture, decisionId, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventTypeKey).toBe('exposure');
    const observations = await waitForMetricObservations(capture, experimentId, variantId, 1);
    expect(observations.reduce((sum, row) => sum + Number(row.value), 0)).toBe(1);
  });
  it('does not attribute conversion by exposure from different decision_id', async () => {
    const subjectId = `subject-${crypto.randomUUID().slice(0, 8)}`;
    const experimentId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-${crypto.randomUUID().slice(0, 8)}`;
    const conversionDecisionId = `decision-${crypto.randomUUID()}`;
    const exposureDecisionId = `decision-${crypto.randomUUID()}`;
    await publishNormalizedBatch(conversionDecisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-conv-${crypto.randomUUID()}`,
        eventTypeKey: 'conversion',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'convert' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: true,
        attributed: false,
      },
    ]);
    await publishNormalizedBatch(exposureDecisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-exposure-${crypto.randomUUID()}`,
        eventTypeKey: 'exposure',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'show' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: false,
        attributed: true,
      },
    ]);
    const exposureRows = await waitForAttributedEvents(capture, exposureDecisionId, 1);
    expect(exposureRows).toHaveLength(1);
    expect(exposureRows[0]?.eventTypeKey).toBe('exposure');
    expect(exposureRows[0]?.decisionId).toBe(exposureDecisionId);
    await sleep(250);
    const conversionRows = await waitForAttributedEvents(capture, conversionDecisionId, 0);
    expect(conversionRows).toHaveLength(0);
  });
  it('flushes multiple pending conversions for one decision_id after exposure', async () => {
    const subjectId = `subject-${crypto.randomUUID().slice(0, 8)}`;
    const experimentId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-${crypto.randomUUID().slice(0, 8)}`;
    const decisionId = `decision-${crypto.randomUUID()}`;
    await publishNormalizedBatch(decisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-conv-a-${crypto.randomUUID()}`,
        eventTypeKey: 'conversion',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'convert-a' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: true,
        attributed: false,
      },
      {
        id: crypto.randomUUID(),
        eventId: `evt-conv-b-${crypto.randomUUID()}`,
        eventTypeKey: 'conversion',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'convert-b' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: true,
        attributed: false,
      },
    ]);
    await publishNormalizedBatch(decisionId, [
      {
        id: crypto.randomUUID(),
        eventId: `evt-exposure-${crypto.randomUUID()}`,
        eventTypeKey: 'exposure',
        eventTypeId: crypto.randomUUID(),
        subjectId,
        experimentId,
        variantId,
        payload: { step: 'show' },
        timestampIso: new Date().toISOString(),
        receivedAtIso: new Date().toISOString(),
        requiresExposure: false,
        attributed: true,
      },
    ]);
    const rows = await waitForAttributedEvents(capture, decisionId, 3);
    expect(rows).toHaveLength(3);
    const attributedConversions = rows.filter((row) => row.eventTypeKey === 'conversion');
    expect(attributedConversions).toHaveLength(2);
    expect(attributedConversions.every((row) => row.attributed === 1)).toBe(true);
    const observations = await waitForMetricObservations(capture, experimentId, variantId, 3);
    expect(observations.reduce((sum, row) => sum + Number(row.value), 0)).toBe(3);
  });
});
