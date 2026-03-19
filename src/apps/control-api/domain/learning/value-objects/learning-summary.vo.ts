import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningSummaryProps {
  value: string;
}

export class LearningSummary extends ValueObject<LearningSummaryProps> {
  static readonly MAX_LENGTH = 4000;
  private constructor(props: LearningSummaryProps) {
    super(props);
  }

  static create(value: string): Result<LearningSummary, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('summary'));
    }

    if (normalized.length > LearningSummary.MAX_LENGTH) {
      return err(new TooLongError('summary', LearningSummary.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningSummary({ value: normalized }));
  }

  static reconstitute(value: string): LearningSummary {
    return new LearningSummary({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
