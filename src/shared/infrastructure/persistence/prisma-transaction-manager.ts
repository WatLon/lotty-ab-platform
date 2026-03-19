import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@/shared/application';
import { DomainEvent, toError } from '@/shared/domain/common';
import { Err } from '@/shared/domain/common/base/result';
import { DomainEventOutboxEnvelopeMapper } from './domain-event-outbox-envelope.mapper';
import { PrismaService } from './prisma.service';
import { toPrismaJson } from './prisma-json.util';
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
class TransactionRollback extends Error {
  constructor(readonly result: unknown) {
    super('TransactionRollback');
  }
}
interface TransactionContext {
  client: PrismaTransactionClient;
  stagedDomainEvents: DomainEvent[];
}

@Injectable()
export class PrismaTransactionManager implements TransactionManager {
  private readonly storage = new AsyncLocalStorage<TransactionContext>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventMapper: DomainEventOutboxEnvelopeMapper,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const existing = this.storage.getStore();
    if (existing) return fn();

    try {
      const value = await this.prisma.$transaction(
        (tx) =>
          this.storage.run(
            {
              client: tx,
              stagedDomainEvents: [],
            },
            async () => {
              const result = await fn();
              if (result instanceof Err) {
                throw new TransactionRollback(result);
              }
              await this.flushStagedDomainEventsToOutbox(tx);
              return result;
            },
          ),
        { timeout: 15000 },
      );
      return value;
    } catch (error: unknown) {
      if (error instanceof TransactionRollback) {
        return error.result as T;
      }
      throw toError(error);
    }
  }

  async stageDomainEvents(events: ReadonlyArray<DomainEvent>): Promise<void> {
    if (events.length === 0) return;

    const context = this.storage.getStore();
    if (context) {
      context.stagedDomainEvents.push(...events);
      return;
    }
    await this.persistDomainEvents(this.prisma, events);
  }
  getClient(): PrismaTransactionClient {
    return this.storage.getStore()?.client ?? this.prisma;
  }
  hasActiveTransaction(): boolean {
    return Boolean(this.storage.getStore());
  }

  private async flushStagedDomainEventsToOutbox(client: PrismaTransactionClient): Promise<void> {
    const context = this.storage.getStore();
    if (!context || context.stagedDomainEvents.length === 0) return;

    await this.persistDomainEvents(client, context.stagedDomainEvents);
    context.stagedDomainEvents.length = 0;
  }

  private async persistDomainEvents(
    client: PrismaTransactionClient,
    events: ReadonlyArray<DomainEvent>,
  ): Promise<void> {
    await client.outboxMessage.createMany({
      data: events.map((event) => {
        const envelope = this.domainEventMapper.map(event);
        return {
          aggregateId: envelope.aggregateId,
          eventType: envelope.eventName,
          payload: toPrismaJson(envelope, 'Outbox domain event payload must be JSON-serializable'),
        };
      }),
    });
  }
}
