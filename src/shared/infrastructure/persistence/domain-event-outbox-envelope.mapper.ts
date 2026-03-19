import { Injectable } from '@nestjs/common';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';
import { DomainEvent } from '@/shared/domain/common';

@Injectable()
export class DomainEventOutboxEnvelopeMapper {
  map(event: DomainEvent): ControlDomainEventEnvelope {
    return {
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventName: event.eventName,
      eventId: event.eventId,
      occurredOn: event.occurredOn.toISOString(),
      version: null,
      payload: 'payload' in event ? event.payload : {},
    };
  }
}
