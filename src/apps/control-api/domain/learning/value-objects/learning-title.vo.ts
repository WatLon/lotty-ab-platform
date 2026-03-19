import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningTitleProps {
  value: string;
}

export class LearningTitle extends ValueObject<LearningTitleProps> {
  static readonly MAX_LENGTH = 200;
  private constructor(props: LearningTitleProps) {
    super(props);
  }

  static create(value: string): Result<LearningTitle, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('title'));
    }

    if (normalized.length > LearningTitle.MAX_LENGTH) {
      return err(new TooLongError('title', LearningTitle.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningTitle({ value: normalized }));
  }

  static reconstitute(value: string): LearningTitle {
    return new LearningTitle({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
