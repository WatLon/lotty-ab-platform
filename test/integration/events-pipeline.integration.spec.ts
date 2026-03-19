import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IngestWorkersModule } from '@/apps/ingest-workers/ingest-workers.module';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { NoopLoggingModule } from '../e2e/noop-logging.module';
import { isolateKafkaConsumerGroupsForTests } from '../support/kafka-test-env';

type CapturedKafkaMessage = {
  topic: string;
  value: unknown;
};
type KafkaCapture = {
  messages: CapturedKafkaMessage[];
  stop: () => Promise<void>;
};
type IngestWorkerEvent = {
  id: string;
  eventId: string;
  eventTypeKey: string;
  eventTypeId: string;
  decisionId: string;
  subjectId: string;
  experimentId: string;
  variantId: string;
  payload: Record<string, unknown> | null;
  timestampIso: string;
  receivedAtIso: string;
  requiresExposure: boolean;
  attributed: boolean;
};
describe('events pipeline integration', () => {
  let app: INestApplication;
  let kafka: KafkaService;
  let redisProvider: RedisClientProvider;
  let capture: KafkaCapture | null = null;
  beforeAll(async () => {
    process.env.APP_SECRET ??= 'integration-app-secret';
    process.env.KAFKA_BROKERS ??= 'localhost:19092';
    isolateKafkaConsumerGroupsForTests('it-events-pipeline');
    const moduleRef = await Test.createTestingModule({
      imports: [NoopLoggingModule, IngestWorkersModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    kafka = app.get(KafkaService);
    redisProvider = app.get(RedisClientProvider);
  });
  beforeEach(async () => {
    const redis = redisProvider.getClient() as
      | {
          flushdb?: () => Promise<unknown>;
          call?: (...args: string[]) => Promise<unknown>;
        }
      | undefined;
    if (redis?.flushdb) {
      await redis.flushdb();
    } else if (redis?.call) {
      await redis.call('FLUSHDB');
    }
    capture = await startKafkaCapture(kafka);
  });
  afterEach(async () => {
    if (capture) {
      await capture.stop();
      capture = null;
    }
  });
  afterAll(async () => {
    await app.close();
  });
  it('deduplicates repeated event ids in normalizer before attribution', async () => {
    const subjectId = `subject-${crypto.randomUUID().slice(0, 8)}`;
    const experimentId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-${crypto.randomUUID().slice(0, 8)}`;
    const duplicateEventId = `evt-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await publishRawBatch(kafka, {
      batchId: crypto.randomUUID(),
      events: [
        createEvent({
          eventId: duplicateEventId,
          eventTypeKey: 'conversion',
          decisionId: `decision-${crypto.randomUUID()}`,
          subjectId,
          experimentId,
          variantId,
          payload: null,
          timestampIso: nowIso,
          receivedAtIso: nowIso,
          requiresExposure: false,
          attributed: true,
        }),
        createEvent({
          eventId: duplicateEventId,
          eventTypeKey: 'conversion',
          decisionId: `decision-${crypto.randomUUID()}`,
          subjectId,
          experimentId,
          variantId,
          payload: null,
          timestampIso: nowIso,
          receivedAtIso: nowIso,
          requiresExposure: false,
          attributed: true,
        }),
      ],
    });
    const normalized = await waitForTopicMessages(
      capture!.messages,
      KAFKA_TOPICS.EVENTS_NORMALIZED,
      1,
    );
    const payload = normalized[0] as {
      batchId: string;
      events: unknown[];
    };
    expect(Array.isArray(payload.events)).toBe(true);
    expect(payload.events.length).toBe(1);
    const rows = (
      await waitForTopicMessages(capture!.messages, KAFKA_TOPICS.EVENTS_ATTRIBUTED, 1)
    ).map(
      (item) =>
        item as {
          eventId: string;
        },
    );
    const observations = (
      await waitForTopicMessages(capture!.messages, KAFKA_TOPICS.METRIC_OBSERVATIONS, 1)
    ).map(
      (item) =>
        item as {
          metricKey: string;
          value: number;
        },
    );
    expect(rows).toHaveLength(1);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ metricKey: 'conversion', value: 1 });
  });
  it('handles out-of-order conversion then exposure through pipeline and attributes conversion later', async () => {
    const subjectId = `subject-${crypto.randomUUID().slice(0, 8)}`;
    const experimentId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    const variantId = `var-${crypto.randomUUID().slice(0, 8)}`;
    const decisionId = `decision-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await publishRawBatch(kafka, {
      batchId: crypto.randomUUID(),
      events: [
        createEvent({
          eventId: `evt-conversion-${crypto.randomUUID()}`,
          eventTypeKey: 'conversion',
          decisionId,
          subjectId,
          experimentId,
          variantId,
          payload: { step: 'convert' },
          timestampIso: nowIso,
          receivedAtIso: nowIso,
          requiresExposure: true,
          attributed: false,
        }),
      ],
    });
    const firstNormalized = await waitForTopicMessages(
      capture!.messages,
      KAFKA_TOPICS.EVENTS_NORMALIZED,
      1,
    );
    expect(firstNormalized.length).toBe(1);
    expect(
      capture!.messages.filter((item) => item.topic === KAFKA_TOPICS.EVENTS_ATTRIBUTED),
    ).toHaveLength(0);
    await publishRawBatch(kafka, {
      batchId: crypto.randomUUID(),
      events: [
        createEvent({
          eventId: `evt-exposure-${crypto.randomUUID()}`,
          eventTypeKey: 'exposure',
          decisionId,
          subjectId,
          experimentId,
          variantId,
          payload: { step: 'show' },
          timestampIso: nowIso,
          receivedAtIso: nowIso,
          requiresExposure: false,
          attributed: true,
        }),
      ],
    });
    const secondNormalized = await waitForTopicMessages(
      capture!.messages,
      KAFKA_TOPICS.EVENTS_NORMALIZED,
      2,
    );
    expect(secondNormalized.length).toBe(2);
    const rows = (
      await waitForTopicMessages(capture!.messages, KAFKA_TOPICS.EVENTS_ATTRIBUTED, 2)
    ).map(
      (item) =>
        item as {
          eventTypeKey: string;
          attributed: number;
        },
    );
    const observations = (
      await waitForTopicMessages(capture!.messages, KAFKA_TOPICS.METRIC_OBSERVATIONS, 2)
    ).map(
      (item) =>
        item as {
          metricKey: string;
          value: number;
        },
    );
    expect(rows).toHaveLength(2);
    expect(observations).toHaveLength(2);
    const conversion = rows.find((row) => row.eventTypeKey === 'conversion');
    const exposure = rows.find((row) => row.eventTypeKey === 'exposure');
    expect(exposure?.attributed).toBe(1);
    expect(conversion?.attributed).toBe(1);
  });
});
async function publishRawBatch(
  kafka: KafkaService,
  batch: {
    batchId: string;
    events: IngestWorkerEvent[];
  },
): Promise<void> {
  await kafka.publish({
    topic: KAFKA_TOPICS.EVENTS_RAW,
    key: batch.events[0]?.decisionId ?? batch.batchId,
    value: batch,
  });
}
function createEvent(params: {
  eventId: string;
  eventTypeKey: string;
  decisionId: string;
  subjectId: string;
  experimentId: string;
  variantId: string;
  payload: Record<string, unknown> | null;
  timestampIso: string;
  receivedAtIso: string;
  requiresExposure: boolean;
  attributed: boolean;
}): IngestWorkerEvent {
  return {
    id: crypto.randomUUID(),
    eventId: params.eventId,
    eventTypeKey: params.eventTypeKey,
    eventTypeId: crypto.randomUUID(),
    decisionId: params.decisionId,
    subjectId: params.subjectId,
    experimentId: params.experimentId,
    variantId: params.variantId,
    payload: params.payload,
    timestampIso: params.timestampIso,
    receivedAtIso: params.receivedAtIso,
    requiresExposure: params.requiresExposure,
    attributed: params.attributed,
  };
}
async function startKafkaCapture(kafka: KafkaService): Promise<KafkaCapture> {
  const consumer = await kafka.createConsumer(`it-events-pipeline-${crypto.randomUUID()}`);
  await consumer.subscribe({ topic: KAFKA_TOPICS.EVENTS_NORMALIZED, fromBeginning: false });
  await consumer.subscribe({ topic: KAFKA_TOPICS.EVENTS_ATTRIBUTED, fromBeginning: false });
  await consumer.subscribe({ topic: KAFKA_TOPICS.METRIC_OBSERVATIONS, fromBeginning: false });
  const messages: CapturedKafkaMessage[] = [];
  let groupJoined = false;
  const groupJoinPromise = new Promise<void>((resolve) => {
    consumer.on(consumer.events.GROUP_JOIN, () => {
      if (groupJoined) return;
      groupJoined = true;
      resolve();
    });
  });
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const raw = message.value?.toString('utf8') ?? 'null';
      let value: unknown = raw;
      try {
        value = JSON.parse(raw);
      } catch {}
      messages.push({ topic, value });
    },
  });
  await Promise.race([groupJoinPromise, sleep(750)]);
  return {
    messages,
    stop: async () => {
      await consumer.stop();
      await consumer.disconnect();
    },
  };
}
async function waitForTopicMessages(
  messages: CapturedKafkaMessage[],
  topic: string,
  expectedCount: number,
): Promise<unknown[]> {
  const deadline = Date.now() + 15000;
  let values: unknown[] = [];
  while (Date.now() < deadline) {
    values = messages.filter((item) => item.topic === topic).map((item) => item.value);
    if (values.length >= expectedCount) {
      return values;
    }
    await sleep(100);
  }
  return values;
}
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
