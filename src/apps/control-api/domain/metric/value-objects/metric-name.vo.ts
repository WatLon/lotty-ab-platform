import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface MetricNameProps {
  value: string;
}

export class MetricName extends ValueObject<MetricNameProps> {
  static readonly MAX_LENGTH = 200;
  private constructor(props: MetricNameProps) {
    super(props);
  }

  static create(value: string): Result<MetricName, RequiredError | TooLongError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError('metricName'));
    }

    if (trimmed.length > MetricName.MAX_LENGTH) {
      return err(new TooLongError('metricName', MetricName.MAX_LENGTH, trimmed.length));
    }

    return ok(new MetricName({ value: trimmed }));
  }

  static reconstitute(value: string): MetricName {
    return new MetricName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
