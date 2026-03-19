import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningTagProps {
  value: string;
}

export class LearningTag extends ValueObject<LearningTagProps> {
  static readonly MAX_LENGTH = 64;
  private constructor(props: LearningTagProps) {
    super(props);
  }

  static create(value: string): Result<LearningTag, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('tag'));
    }

    if (normalized.length > LearningTag.MAX_LENGTH) {
      return err(new TooLongError('tag', LearningTag.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningTag({ value: normalized }));
  }

  static reconstitute(value: string): LearningTag {
    return new LearningTag({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
