import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Producer } from 'kafkajs';
import { IngestEventMessage } from '@/contracts/ingest-events';
import { AppLogger } from '@/shared/application';
import { toError } from '@/shared/domain/common';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { IngestEventsBatch } from '../ingest-api/application';

@Injectable()
export class AttributionConsumer implements OnModuleInit, OnModuleDestroy {
  private static readonly EXPOSURE_PREFIX = 'attr:exposure:';

  private static readonly PENDING_PREFIX = 'attr:pending:';

  private static readonly TTL_7_DAYS = 7 * 24 * 60 * 60;

  private txProducer: Producer | null = null;

  constructor(
    private readonly config: TypedConfigService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisClientProvider,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const groupId = this.config.get('EVENTS_ATTRIBUTION_GROUP_ID');
    this.txProducer = await this.kafka.ensureTransactionalProducer(`attribution-tx-${groupId}`);
    const consumer = await this.kafka.createConsumer(groupId);
    await consumer.subscribe({ topic: KAFKA_TOPICS.EVENTS_NORMALIZED, fromBeginning: false });

    void consumer
      .run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return;

          try {
            const batch = JSON.parse(message.value.toString()) as IngestEventsBatch;
            const { records, observations, exposuresToPersist } = await this.processBatch(batch);
            void exposuresToPersist;

            const transaction = await this.txProducer!.transaction();
            try {
              if (records.length > 0) {
                await transaction.send({
                  topic: KAFKA_TOPICS.EVENTS_ATTRIBUTED,
                  messages: records.map((r) => ({
                    key: r.decisionId,
                    value: JSON.stringify(r),
                  })),
                });
              }

              if (observations.length > 0) {
                await transaction.send({
                  topic: KAFKA_TOPICS.METRIC_OBSERVATIONS,
                  messages: observations.map((o) => ({
                    key: o.experimentId,
                    value: JSON.stringify(o),
                  })),
                });
              }

              await transaction.sendOffsets({
                consumerGroupId: groupId,
                topics: [
                  {
                    topic,
                    partitions: [
                      {
                        partition,
                        offset: String(BigInt(message.offset) + 1n),
                      },
                    ],
                  },
                ],
              });

              await transaction.commit();
            } catch (error: unknown) {
              await transaction.abort();
              throw error;
            }
          } catch (error) {
            this.logger.error(
              {
                event: 'attribution.failed',
                domain: 'infrastructure',
                operation: 'AttributionConsumer',
                status: 'failure',
              },
              error,
              'failed to attribute event batch',
            );
            throw toError(error);
          }
        },
      })
      .catch((error: unknown) => {
        this.logger.error(
          {
            event: 'attribution.consumer.run_failed',
            domain: 'infrastructure',
            operation: 'AttributionConsumer.onModuleInit',
            status: 'failure',
          },
          error,
          'attribution consumer stopped unexpectedly',
        );
        process.exit(1);
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.txProducer) {
      await this.txProducer.disconnect().catch(() => {});
      this.txProducer = null;
    }
  }

  private async processBatch(batch: IngestEventsBatch): Promise<{
    records: AttributedEventMessage[];
    observations: MetricObservation[];
    exposuresToPersist: Set<string>;
  }> {
    if (batch.events.length === 0) {
      return {
        records: [],
        observations: [],
        exposuresToPersist: new Set<string>(),
      };
    }

    const events = batch.events;
    const client = this.redis.getClient();
    const inBatchExposures = new Set<string>();

    for (const e of events) {
      if (!e.requiresExposure) inBatchExposures.add(e.decisionId);
    }

    const needCheck: string[] = [];

    for (const e of events) {
      if (!e.requiresExposure) continue;

      if (!e.experimentId || !e.variantId) continue;

      if (inBatchExposures.has(e.decisionId)) continue;

      needCheck.push(e.decisionId);
    }

    const storedExposures = new Map<string, boolean>();

    if (needCheck.length > 0) {
      const pipeline = client.pipeline();

      for (const id of needCheck) pipeline.exists(`${AttributionConsumer.EXPOSURE_PREFIX}${id}`);

      const results = await pipeline.exec();

      if (results) {
        for (let i = 0; i < needCheck.length; i++) {
          const [err, val] = results[i] ?? [];
          storedExposures.set(needCheck[i], !err && Number(val) > 0);
        }
      }
    }

    const records: AttributedEventMessage[] = [];
    const observations: MetricObservation[] = [];
    const pendingByDecision = new Map<string, string[]>();
    const exposuresToPersist = new Set<string>();

    for (const event of events) {
      if (!event.requiresExposure) {
        records.push(this.toRecord(event, true));
        this.addObservations(observations, event);
        exposuresToPersist.add(event.decisionId);
        continue;
      }

      if (!event.experimentId || !event.variantId) {
        records.push(this.toRecord(event, false));
        continue;
      }

      if (inBatchExposures.has(event.decisionId)) {
        records.push(this.toRecord(event, true));
        this.addObservations(observations, event);
        continue;
      }

      if (storedExposures.get(event.decisionId)) {
        records.push(this.toRecord(event, true));
        this.addObservations(observations, event);
        continue;
      }

      const list = pendingByDecision.get(event.decisionId) ?? [];
      list.push(JSON.stringify(event));

      pendingByDecision.set(event.decisionId, list);
    }

    if (pendingByDecision.size > 0) {
      const pipeline = client.pipeline();

      for (const [decisionId, serialized] of pendingByDecision) {
        const key = `${AttributionConsumer.PENDING_PREFIX}${decisionId}`;
        pipeline.rpush(key, ...serialized);
        pipeline.expire(key, AttributionConsumer.TTL_7_DAYS);
      }

      await pipeline.exec();
    }

    for (const decisionId of exposuresToPersist) {
      await client.set(
        `${AttributionConsumer.EXPOSURE_PREFIX}${decisionId}`,
        '1',
        'EX',
        AttributionConsumer.TTL_7_DAYS,
      );

      const pendingKey = `${AttributionConsumer.PENDING_PREFIX}${decisionId}`;

      const tx = client.multi();

      tx.lrange(pendingKey, 0, -1);
      tx.del(pendingKey);

      const txResult = await tx.exec();
      const raw = txResult?.[0]?.[1];
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const flushedRecords: AttributedEventMessage[] = [];
      const flushedObservations: MetricObservation[] = [];

      for (const serialized of raw) {
        if (typeof serialized !== 'string') continue;

        try {
          const event = JSON.parse(serialized) as IngestEventMessage;

          flushedRecords.push(this.toRecord(event, true));
          this.addObservations(flushedObservations, event);
        } catch {
          this.logger.warn({
            event: 'attribution.pending.parse_failed',
            domain: 'infrastructure',
            operation: 'AttributionConsumer',
            status: 'failure',
            meta: { decisionId },
          });
        }
      }

      records.push(...flushedRecords);
      observations.push(...flushedObservations);
    }

    return { records, observations, exposuresToPersist };
  }

  private toRecord(event: IngestEventMessage, attributed: boolean): AttributedEventMessage {
    return {
      id: event.id,
      eventId: event.eventId,
      eventTypeKey: event.eventTypeKey,
      eventTypeId: event.eventTypeId,
      decisionId: event.decisionId,
      subjectId: event.subjectId,
      experimentId: event.experimentId ?? '',
      variantId: event.variantId ?? '',
      payload: event.payload ? JSON.stringify(event.payload) : '',
      timestamp: event.timestampIso,
      receivedAt: event.receivedAtIso,
      requiresExposure: event.requiresExposure ? 1 : 0,
      attributed: attributed ? 1 : 0,
    };
  }

  private addObservations(observations: MetricObservation[], event: IngestEventMessage): void {
    if (!event.experimentId || !event.variantId) return;

    observations.push({
      observationId: `${event.eventId}:${event.eventTypeKey}`,
      experimentId: event.experimentId,
      variantId: event.variantId,
      metricKey: event.eventTypeKey,
      timestamp: event.timestampIso,
      value: 1.0,
    });

    if (event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)) {
      for (const [field, val] of Object.entries(event.payload)) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          observations.push({
            observationId: `${event.eventId}:${event.eventTypeKey}.${field}`,
            experimentId: event.experimentId,
            variantId: event.variantId,
            metricKey: `${event.eventTypeKey}.${field}`,
            timestamp: event.timestampIso,
            value: val,
          });
        }
      }
    }
  }
}

interface AttributedEventMessage {
  id: string;
  eventId: string;
  eventTypeKey: string;
  eventTypeId: string;
  decisionId: string;
  subjectId: string;
  experimentId: string;
  variantId: string;
  payload: string;
  timestamp: string;
  receivedAt: string;
  requiresExposure: 0 | 1;
  attributed: 0 | 1;
}
interface MetricObservation {
  observationId: string;
  experimentId: string;
  variantId: string;
  metricKey: string;
  timestamp: string;
  value: number;
}
