import { DomainEvent } from './domain-event.base';
import { Entity } from './entity.base';
import { Identity, StringId } from './identity';

export abstract class AggregateRoot<TProps, TId extends Identity = StringId> extends Entity<
  TProps,
  TId
> {
  private readonly _domainEvents: DomainEvent[] = [];

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents.length = 0;
  }
}
