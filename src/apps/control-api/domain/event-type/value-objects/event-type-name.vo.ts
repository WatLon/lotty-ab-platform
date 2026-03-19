import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';
import { EVENT_TYPE_NAME_MAX_LENGTH } from '@/shared/domain/event-type.rules';

interface EventTypeNameProps {
  value: string;
}

export class EventTypeName extends ValueObject<EventTypeNameProps> {
  static readonly MAX_LENGTH = EVENT_TYPE_NAME_MAX_LENGTH;
  private constructor(props: EventTypeNameProps) {
    super(props);
  }

  static create(value: string): Result<EventTypeName, RequiredError | TooLongError> {
    const trimmed = value.trim();
    if (!trimmed) {
      return err(new RequiredError('eventTypeName'));
    }
    if (trimmed.length > EventTypeName.MAX_LENGTH) {
      return err(new TooLongError('eventTypeName', EventTypeName.MAX_LENGTH, trimmed.length));
    }
    return ok(new EventTypeName({ value: trimmed }));
  }

  static reconstitute(value: string): EventTypeName {
    return new EventTypeName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
