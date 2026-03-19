import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningActionTakenProps {
  value: string;
}

export class LearningActionTaken extends ValueObject<LearningActionTakenProps> {
  static readonly MAX_LENGTH = 200;
  private constructor(props: LearningActionTakenProps) {
    super(props);
  }

  static create(value: string): Result<LearningActionTaken, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('actionTaken'));
    }

    if (normalized.length > LearningActionTaken.MAX_LENGTH) {
      return err(
        new TooLongError('actionTaken', LearningActionTaken.MAX_LENGTH, normalized.length),
      );
    }

    return ok(new LearningActionTaken({ value: normalized }));
  }

  static reconstitute(value: string): LearningActionTaken {
    return new LearningActionTaken({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
