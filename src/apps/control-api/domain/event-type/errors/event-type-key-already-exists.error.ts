import { BusinessRuleError } from '@/shared/domain/common';
import { EventTypeKey } from '../value-objects/event-type-key.vo';
import { EventTypeErrorCode } from './codes';

export class EventTypeKeyAlreadyExistsError extends BusinessRuleError {
  readonly code = EventTypeErrorCode.EVENT_TYPE_KEY_ALREADY_EXISTS;

  constructor(key: EventTypeKey) {
    super(`Event type with key "${key.value}" already exists`);
  }
}
