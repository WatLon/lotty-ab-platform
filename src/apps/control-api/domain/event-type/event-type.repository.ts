import { ConcurrencyError, Result } from '@/shared/domain/common';
import { EventTypeKeyAlreadyExistsError } from './errors';
import { EventType } from './event-type.aggregate-root';
import { EventTypeId } from './event-type.id';
import { EventTypeKey } from './value-objects/event-type-key.vo';

export abstract class EventTypeRepository {
  abstract findById(id: EventTypeId): Promise<EventType | null>;

  abstract findByKey(key: EventTypeKey): Promise<EventType | null>;

  abstract findByKeys(keys: EventTypeKey[]): Promise<EventType[]>;

  abstract save(
    entity: EventType,
  ): Promise<Result<void, ConcurrencyError | EventTypeKeyAlreadyExistsError>>;
}
