import { BusinessRuleError } from '@/shared/domain/common';
import { EventTypeErrorCode } from './codes';

export interface EventTypeArchivedMetadata {
  eventTypeKey: string;
  index: number;
  eventId: string | null;
}

export class EventTypeArchivedError extends BusinessRuleError {
  readonly code = EventTypeErrorCode.EVENT_TYPE_ARCHIVED;

  public readonly metadata: EventTypeArchivedMetadata;

  constructor(key: string, metadata: Omit<EventTypeArchivedMetadata, 'eventTypeKey'>) {
    super(`Event type "${key}" is archived`);
    this.metadata = {
      eventTypeKey: key,
      ...metadata,
    };
  }

  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
