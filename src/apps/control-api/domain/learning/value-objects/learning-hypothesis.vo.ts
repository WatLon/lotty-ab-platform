import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningHypothesisProps {
  value: string;
}

export class LearningHypothesis extends ValueObject<LearningHypothesisProps> {
  static readonly MAX_LENGTH = 4000;
  private constructor(props: LearningHypothesisProps) {
    super(props);
  }

  static create(value: string): Result<LearningHypothesis, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('hypothesis'));
    }

    if (normalized.length > LearningHypothesis.MAX_LENGTH) {
      return err(new TooLongError('hypothesis', LearningHypothesis.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningHypothesis({ value: normalized }));
  }

  static reconstitute(value: string): LearningHypothesis {
    return new LearningHypothesis({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
