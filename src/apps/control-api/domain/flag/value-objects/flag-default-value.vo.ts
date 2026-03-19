import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError } from '@/shared/domain/common/errors';
import { FlagValueType } from '../flag-value-type.enum';

interface FlagDefaultValueProps {
  value: string;
}

export class FlagDefaultValue extends ValueObject<FlagDefaultValueProps> {
  private constructor(props: FlagDefaultValueProps) {
    super(props);
  }

  static create(
    value: string,
    valueType: FlagValueType,
  ): Result<FlagDefaultValue, RequiredError | InvalidFormatError> {
    if (value === undefined || value === null || value === '') {
      return err(new RequiredError('defaultValue'));
    }

    switch (valueType) {
      case FlagValueType.NUMBER:
        if (Number.isNaN(Number(value))) {
          return err(new InvalidFormatError('defaultValue', 'valid number'));
        }
        break;
      case FlagValueType.BOOLEAN:
        if (value !== 'true' && value !== 'false') {
          return err(new InvalidFormatError('defaultValue', '"true" or "false"'));
        }
        break;
      case FlagValueType.STRING:
        break;
    }

    return ok(new FlagDefaultValue({ value }));
  }

  static reconstitute(value: string): FlagDefaultValue {
    return new FlagDefaultValue({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
