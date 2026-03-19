import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DecisionAnalyticsRepository } from '@/apps/decide-api/application';
import type { Decision } from '@/apps/decide-api/domain';
import { AppLogger } from '@/shared/application';
import { ok, Result } from '@/shared/domain/common';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';

@Injectable()
export class DecisionKafkaLogRepository implements DecisionAnalyticsRepository, OnModuleDestroy {
  private static readonly MAX_BUFFER_SIZE = 50000;

  private static readonly FLUSH_INTERVAL_MS = 25;

  private static readonly FLUSH_BATCH_SIZE = 2000;

  private readonly buffer: Decision[] = [];

  private flushing = false;

  private readonly flushTimer: NodeJS.Timeout;

  constructor(
    private readonly kafka: KafkaService,
    private readonly appLogger: AppLogger,
  ) {
    this.flushTimer = setInterval(() => {
      void this.flushBuffered();
    }, DecisionKafkaLogRepository.FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }

  async saveMany(decisions: Decision[]): Promise<Result<void, never>> {
    if (decisions.length === 0) return ok(undefined);

    if (this.buffer.length + decisions.length > DecisionKafkaLogRepository.MAX_BUFFER_SIZE) {
      this.appLogger.error(
        {
          event: 'decision.log.buffer_full',
          domain: 'infrastructure',
          operation: 'DecisionKafkaLogRepository.saveMany',
          status: 'failure',
          meta: {
            rejected: decisions.length,
            buffered: this.buffer.length,
            maxBufferSize: DecisionKafkaLogRepository.MAX_BUFFER_SIZE,
          },
        },
        undefined,
        'decision log buffer full; rejecting batch to avoid silent data loss',
      );
      return ok(undefined);
    }
    this.buffer.push(...decisions);
    return ok(undefined);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flushTimer);
    await this.flushBuffered();
  }

  private async flushBuffered(): Promise<void> {
    if (this.flushing) return;
    if (this.buffer.length === 0) return;

    this.flushing = true;
    const batch = this.buffer.splice(0, DecisionKafkaLogRepository.FLUSH_BATCH_SIZE);

    try {
      await this.kafka.publishBatch(
        batch.map((decision) => ({
          topic: KAFKA_TOPICS.DECISION_LOGS,
          key: decision.subjectId,
          value: {
            id: decision.id,
            subjectId: decision.subjectId,
            flagId: decision.flagId,
            experimentId: decision.experimentId,
            variantId: decision.variantId,
            value: decision.value,
            reason: decision.reason,
            subjectAttributes: decision.subjectAttributes,
            createdAt: decision.createdAt.toISOString(),
          },
        })),
      );
    } catch {
      this.buffer.unshift(...batch);
      this.appLogger.warn(
        {
          event: 'decision.log.kafka_flush_failed',
          domain: 'infrastructure',
          operation: 'DecisionKafkaLogRepository.flushBuffered',
          status: 'failure',
          meta: {
            buffered: this.buffer.length,
            batchSize: batch.length,
          },
        },
        'failed to flush decision logs to kafka',
      );
    } finally {
      this.flushing = false;
    }
  }
}
