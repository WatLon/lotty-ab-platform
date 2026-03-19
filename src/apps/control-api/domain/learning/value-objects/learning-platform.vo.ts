import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningPlatformProps {
  value: string;
}

export class LearningPlatform extends ValueObject<LearningPlatformProps> {
  static readonly MAX_LENGTH = 64;
  private constructor(props: LearningPlatformProps) {
    super(props);
  }

  static create(value: string): Result<LearningPlatform, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('platform'));
    }

    if (normalized.length > LearningPlatform.MAX_LENGTH) {
      return err(new TooLongError('platform', LearningPlatform.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningPlatform({ value: normalized }));
  }

  static reconstitute(value: string): LearningPlatform {
    return new LearningPlatform({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
