import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError, TooLongError } from '@/shared/domain/common/errors';
import {
  EVENT_TYPE_KEY_FORMAT,
  EVENT_TYPE_KEY_MAX_LENGTH,
} from '@/shared/domain/event-type-key.rules';

interface EventTypeKeyProps {
  value: string;
}

export class EventTypeKey extends ValueObject<EventTypeKeyProps> {
  static readonly MAX_LENGTH = EVENT_TYPE_KEY_MAX_LENGTH;
  static readonly FORMAT = EVENT_TYPE_KEY_FORMAT;
  private constructor(props: EventTypeKeyProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<EventTypeKey, RequiredError | TooLongError | InvalidFormatError> {
    const trimmed = value.trim();
    if (!trimmed) return err(new RequiredError('eventTypeKey'));

    if (trimmed.length > EventTypeKey.MAX_LENGTH) {
      return err(new TooLongError('eventTypeKey', EventTypeKey.MAX_LENGTH, trimmed.length));
    }
    if (!EventTypeKey.FORMAT.test(trimmed)) {
      return err(
        new InvalidFormatError(
          'eventTypeKey',
          'lowercase letters, digits, underscores, dots; must start with letter',
        ),
      );
    }
    return ok(new EventTypeKey({ value: trimmed }));
  }

  static reconstitute(value: string): EventTypeKey {
    return new EventTypeKey({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
