import { DomainEvent, DomainEventProps } from '@/shared/domain/common';

export type EventTypeUpdatedPayload = {
  id: string;
  key: string;
  schema: unknown;
  requiresExposure: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export class EventTypeUpdated extends DomainEvent {
  readonly aggregateType = 'EventType';

  readonly eventName = 'EventTypeUpdated';

  constructor(
    props: DomainEventProps,
    public readonly payload: EventTypeUpdatedPayload,
  ) {
    super(props);
  }
}
