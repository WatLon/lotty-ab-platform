import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError } from '@/shared/domain/common/errors';
import { validateEventTypeSchemaDefinition } from '@/shared/domain/event-type-schema.validator';

interface EventTypeSchemaProps {
  value: Record<string, unknown> | null;
}

export class EventTypeSchema extends ValueObject<EventTypeSchemaProps> {
  private constructor(props: EventTypeSchemaProps) {
    super(props);
  }

  static create(value: unknown): Result<EventTypeSchema, InvalidFormatError> {
    const validationError = validateEventTypeSchemaDefinition(value);
    if (validationError) {
      return err(new InvalidFormatError('eventTypeSchema', validationError));
    }
    return ok(new EventTypeSchema({ value: value as Record<string, unknown> | null }));
  }

  static reconstitute(value: unknown): EventTypeSchema {
    return new EventTypeSchema({ value: value as Record<string, unknown> | null });
  }

  get value(): Record<string, unknown> | null {
    return this.props.value;
  }
}
