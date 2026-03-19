import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningCountryProps {
  value: string;
}

export class LearningCountry extends ValueObject<LearningCountryProps> {
  static readonly MAX_LENGTH = 64;
  private constructor(props: LearningCountryProps) {
    super(props);
  }

  static create(value: string): Result<LearningCountry, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('country'));
    }

    if (normalized.length > LearningCountry.MAX_LENGTH) {
      return err(new TooLongError('country', LearningCountry.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningCountry({ value: normalized }));
  }

  static reconstitute(value: string): LearningCountry {
    return new LearningCountry({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
