import { randomUUID } from 'node:crypto';

export interface DomainEventProps {
  aggregateId: string;
  eventId?: string;
  occurredOn?: Date;
}

export abstract class DomainEvent {
  public readonly eventId: string;

  public readonly aggregateId: string;

  public readonly occurredOn: Date;

  public abstract readonly aggregateType: string;

  public abstract readonly eventName: string;

  constructor(props: DomainEventProps) {
    this.eventId = props.eventId ?? randomUUID();
    this.aggregateId = props.aggregateId;
    this.occurredOn = props.occurredOn ?? new Date();
  }
}
