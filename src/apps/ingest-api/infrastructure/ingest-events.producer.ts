import { Injectable } from '@nestjs/common';
import { IngestEventsBatch, IngestEventsQueue } from '@/apps/ingest-api/application';
import { QueueUnavailableError } from '@/apps/ingest-api/domain';
import { AppLogger } from '@/shared/application';
import { err, ok, Result } from '@/shared/domain/common';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';

@Injectable()
export class KafkaIngestEventsQueue implements IngestEventsQueue {
  constructor(
    private readonly kafka: KafkaService,
    private readonly appLogger: AppLogger,
  ) {}

  async enqueue(batch: IngestEventsBatch): Promise<Result<void, QueueUnavailableError>> {
    try {
      await this.kafka.publish({
        topic: KAFKA_TOPICS.EVENTS_RAW,
        key: batch.events[0]?.decisionId ?? batch.batchId,
        value: batch,
      });
      return ok(undefined);
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'ingest.kafka.publish_failed',
          domain: 'infrastructure',
          operation: 'KafkaIngestEventsQueue.enqueue',
          status: 'failure',
          meta: {
            batchId: batch.batchId,
            eventCount: batch.events.length,
          },
        },
        error,
        'kafka unavailable; ingest batch publish failed',
      );
      return err(
        new QueueUnavailableError({
          index: 0,
          eventId: batch.events[0]?.eventId ?? null,
        }),
      );
    }
  }
}
