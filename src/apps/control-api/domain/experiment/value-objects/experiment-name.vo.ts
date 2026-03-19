import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError, TooShortError } from '@/shared/domain/common/errors';

interface ExperimentNameProps {
  value: string;
}

export class ExperimentName extends ValueObject<ExperimentNameProps> {
  static readonly MIN_LENGTH = 3;
  static readonly MAX_LENGTH = 200;
  private constructor(props: ExperimentNameProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<ExperimentName, RequiredError | TooShortError | TooLongError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError('experimentName'));
    }

    if (trimmed.length < ExperimentName.MIN_LENGTH) {
      return err(new TooShortError('experimentName', ExperimentName.MIN_LENGTH, trimmed.length));
    }

    if (trimmed.length > ExperimentName.MAX_LENGTH) {
      return err(new TooLongError('experimentName', ExperimentName.MAX_LENGTH, trimmed.length));
    }

    return ok(new ExperimentName({ value: trimmed }));
  }

  static reconstitute(value: string): ExperimentName {
    return new ExperimentName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
