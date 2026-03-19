import type { DomainEvent } from '@/shared/domain/common';
export abstract class TransactionManager {
  abstract execute<T>(fn: () => Promise<T>): Promise<T>;
  abstract stageDomainEvents(events: ReadonlyArray<DomainEvent>): Promise<void>;
}
