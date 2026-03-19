import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { TooLongError } from '@/shared/domain/common/errors';
import { EVENT_TYPE_DESCRIPTION_MAX_LENGTH } from '@/shared/domain/event-type.rules';

interface EventTypeDescriptionProps {
  value: string;
}

export class EventTypeDescription extends ValueObject<EventTypeDescriptionProps> {
  static readonly MAX_LENGTH = EVENT_TYPE_DESCRIPTION_MAX_LENGTH;
  private constructor(props: EventTypeDescriptionProps) {
    super(props);
  }

  static create(value: string): Result<EventTypeDescription, TooLongError> {
    const trimmed = value.trim();
    if (trimmed.length > EventTypeDescription.MAX_LENGTH) {
      return err(
        new TooLongError('eventTypeDescription', EventTypeDescription.MAX_LENGTH, trimmed.length),
      );
    }
    return ok(new EventTypeDescription({ value: trimmed }));
  }

  static reconstitute(value: string): EventTypeDescription {
    return new EventTypeDescription({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
