import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface VariantNameProps {
  value: string;
}

export class VariantName extends ValueObject<VariantNameProps> {
  static readonly MAX_LENGTH = 100;
  private constructor(props: VariantNameProps) {
    super(props);
  }

  static create(value: string): Result<VariantName, RequiredError | TooLongError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError('variantName'));
    }

    if (trimmed.length > VariantName.MAX_LENGTH) {
      return err(new TooLongError('variantName', VariantName.MAX_LENGTH, trimmed.length));
    }

    return ok(new VariantName({ value: trimmed }));
  }

  static reconstitute(value: string): VariantName {
    return new VariantName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
