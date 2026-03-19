import { DomainEvent } from './domain-event.base';
import { Entity } from './entity.base';
import { Identity, StringId } from './identity';

export abstract class EventSourcedAggregateRoot<
  TProps,
  TId extends Identity = StringId,
  TEvent extends DomainEvent = DomainEvent,
> extends Entity<TProps, TId> {
  private readonly _uncommittedEvents: TEvent[] = [];

  protected constructor(initialProps: TProps, id: TId) {
    super(initialProps, id);
  }

  get uncommittedEvents(): ReadonlyArray<TEvent> {
    return [...this._uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this._uncommittedEvents.length = 0;
  }

  protected raise(event: TEvent): void {
    this.apply(event);
    this._uncommittedEvents.push(event);
  }

  public loadFromHistory(events: TEvent[]): void {
    for (const event of events) {
      this.apply(event);
    }
  }

  protected abstract apply(event: TEvent): void;
}
