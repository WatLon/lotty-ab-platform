import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningFeatureKeyProps {
  value: string;
}

export class LearningFeatureKey extends ValueObject<LearningFeatureKeyProps> {
  static readonly MAX_LENGTH = 128;
  static readonly FORMAT = /^[a-z][a-z0-9_.]*$/;
  private constructor(props: LearningFeatureKeyProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<LearningFeatureKey, RequiredError | TooLongError | InvalidFormatError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('featureKey'));
    }

    if (normalized.length > LearningFeatureKey.MAX_LENGTH) {
      return err(new TooLongError('featureKey', LearningFeatureKey.MAX_LENGTH, normalized.length));
    }

    if (!LearningFeatureKey.FORMAT.test(normalized)) {
      return err(
        new InvalidFormatError(
          'featureKey',
          'lowercase letters, digits, underscores, dots; must start with letter',
        ),
      );
    }

    return ok(new LearningFeatureKey({ value: normalized }));
  }

  static reconstitute(value: string): LearningFeatureKey {
    return new LearningFeatureKey({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
