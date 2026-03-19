import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface VariantValueProps {
  value: string;
}

export class VariantValue extends ValueObject<VariantValueProps> {
  static readonly MAX_LENGTH = 1000;
  private constructor(props: VariantValueProps) {
    super(props);
  }

  static create(value: string): Result<VariantValue, RequiredError | TooLongError> {
    if (value === undefined || value === null || value === '') {
      return err(new RequiredError('variantValue'));
    }

    if (value.length > VariantValue.MAX_LENGTH) {
      return err(new TooLongError('variantValue', VariantValue.MAX_LENGTH, value.length));
    }

    return ok(new VariantValue({ value }));
  }

  static reconstitute(value: string): VariantValue {
    return new VariantValue({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
