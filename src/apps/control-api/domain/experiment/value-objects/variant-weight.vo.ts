import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { TooHighError, TooLowError } from '@/shared/domain/common/errors';

interface VariantWeightProps {
  value: number;
}

export class VariantWeight extends ValueObject<VariantWeightProps> {
  static readonly MIN_VALUE = 1;
  static readonly MAX_VALUE = 100;
  private constructor(props: VariantWeightProps) {
    super(props);
  }

  static create(value: number): Result<VariantWeight, TooLowError | TooHighError> {
    if (value < VariantWeight.MIN_VALUE) {
      return err(new TooLowError('variantWeight', VariantWeight.MIN_VALUE, value));
    }

    if (value > VariantWeight.MAX_VALUE) {
      return err(new TooHighError('variantWeight', VariantWeight.MAX_VALUE, value));
    }

    return ok(new VariantWeight({ value }));
  }

  static reconstitute(value: number): VariantWeight {
    return new VariantWeight({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
