import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '@/shared/application';
import { toError } from '@/shared/domain/common';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { IngestEventsBatch } from '../ingest-api/application';

@Injectable()
export class DeduplicationConsumer implements OnModuleInit {
  private static readonly IDEMPOTENCY_PREFIX = 'idem:event:';

  private static readonly IDEMPOTENCY_TTL = 7 * 24 * 60 * 60;

  constructor(
    private readonly config: TypedConfigService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisClientProvider,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const groupId = this.config.get('EVENTS_NORMALIZER_GROUP_ID');
    const consumer = await this.kafka.createConsumer(groupId);
    await consumer.subscribe({ topic: KAFKA_TOPICS.EVENTS_RAW, fromBeginning: false });

    void consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        try {
          const batch = JSON.parse(message.value.toString()) as IngestEventsBatch;
          if (batch.events.length === 0) return;

          const pipeline = this.redis.getClient().pipeline();

          for (const event of batch.events) {
            pipeline.set(
              `${DeduplicationConsumer.IDEMPOTENCY_PREFIX}${event.eventId}`,
              '1',
              'EX',
              DeduplicationConsumer.IDEMPOTENCY_TTL,
              'NX',
            );
          }

          const results = await pipeline.exec();
          if (!results) return;

          const unique = batch.events.filter((_, i) => {
            const [err, reply] = results[i] ?? [];
            return !err && reply === 'OK';
          });

          if (unique.length === 0) return;

          await this.kafka.publish({
            topic: KAFKA_TOPICS.EVENTS_NORMALIZED,
            key: unique[0]?.decisionId ?? batch.batchId,
            value: { batchId: batch.batchId, events: unique },
          });
        } catch (error) {
          this.logger.error(
            {
              event: 'deduplication.failed',
              domain: 'infrastructure',
              operation: 'DeduplicationConsumer',
              status: 'failure',
            },
            error,
            'failed to deduplicate event batch',
          );
          throw toError(error);
        }
      },
    });
  }
}
