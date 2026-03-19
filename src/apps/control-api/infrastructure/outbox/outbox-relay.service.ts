import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';
import { AppLogger } from '@/shared/application';
import { KAFKA_HEADERS, KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { PrismaService } from '@/shared/infrastructure/persistence';

@Injectable()
export class OutboxRelayService {
  private static readonly BATCH_SIZE = 100;
  private static readonly MAX_RETRIES = 5;
  private static readonly CONCURRENCY = 10;
  private static readonly CLEANUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  private relaying = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly appLogger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async relay(): Promise<void> {
    if (this.relaying) return;

    this.relaying = true;

    try {
      const messages = await this.prisma.outboxMessage.findMany({
        select: { id: true, eventType: true, payload: true, retryCount: true },
        where: {
          processedAt: null,
          retryCount: { lt: OutboxRelayService.MAX_RETRIES },
        },
        orderBy: { createdAt: 'asc' },
        take: OutboxRelayService.BATCH_SIZE,
      });

      if (messages.length === 0) return;

      const succeeded: string[] = [];
      const failed: typeof messages = [];
      let cursor = 0;

      const worker = async () => {
        while (cursor < messages.length) {
          const message = messages[cursor++];

          try {
            const envelopeParsed = ControlDomainEventEnvelope.safeParse(message.payload);

            if (!envelopeParsed.success) {
              this.appLogger.warn({
                event: 'infrastructure.outbox.relay.invalid_payload',
                domain: 'infrastructure',
                operation: 'OutboxRelayService.relay',
                status: 'failure',
                meta: { outboxMessageId: message.id, eventType: message.eventType },
              });
              succeeded.push(message.id);
              continue;
            }
            const envelope = envelopeParsed.data;
            await this.kafka.publish({
              topic: KAFKA_TOPICS.CONTROL_DOMAIN_EVENTS,
              key: envelope.aggregateId,
              headers: {
                [KAFKA_HEADERS.EVENT_TYPE]: envelope.eventName,
              },
              value: envelope,
            });
            succeeded.push(message.id);
          } catch {
            failed.push(message);
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(OutboxRelayService.CONCURRENCY, messages.length) }, () =>
          worker(),
        ),
      );
      if (succeeded.length > 0) {
        await this.prisma.outboxMessage.updateMany({
          where: { id: { in: succeeded } },
          data: { processedAt: new Date() },
        });
      }
      if (failed.length > 0) {
        const deadLettered: string[] = [];
        const retryable: string[] = [];
        for (const message of failed) {
          if (message.retryCount + 1 >= OutboxRelayService.MAX_RETRIES) {
            deadLettered.push(message.id);
            this.appLogger.error(
              {
                event: 'infrastructure.outbox.relay.dead_letter',
                domain: 'infrastructure',
                operation: 'OutboxRelayService.relay',
                status: 'failure',
                meta: {
                  messageId: message.id,
                  eventType: message.eventType,
                  retries: message.retryCount + 1,
                },
              },
              undefined,
              'outbox message exceeded max retries',
            );
          } else {
            retryable.push(message.id);
          }
        }
        if (deadLettered.length > 0) {
          await this.prisma.outboxMessage.updateMany({
            where: { id: { in: deadLettered } },
            data: { processedAt: new Date(), retryCount: OutboxRelayService.MAX_RETRIES },
          });
        }
        if (retryable.length > 0) {
          await this.prisma.outboxMessage.updateMany({
            where: { id: { in: retryable } },
            data: { retryCount: { increment: 1 } },
          });
        }
      }
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'infrastructure.outbox.relay.cycle_failed',
          domain: 'infrastructure',
          operation: 'OutboxRelayService.relay',
          status: 'failure',
        },
        error,
        'outbox relay cycle failed',
      );
    } finally {
      this.relaying = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - OutboxRelayService.CLEANUP_RETENTION_MS);
    await this.prisma.outboxMessage.deleteMany({
      where: { processedAt: { not: null, lt: cutoff } },
    });
  }
}
