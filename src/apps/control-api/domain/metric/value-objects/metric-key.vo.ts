import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface MetricKeyProps {
  value: string;
}

export class MetricKey extends ValueObject<MetricKeyProps> {
  static readonly MAX_LENGTH = 128;
  static readonly FORMAT = /^[a-z][a-z0-9_.]*$/;
  private constructor(props: MetricKeyProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<MetricKey, RequiredError | TooLongError | InvalidFormatError> {
    const trimmed = value.trim();

    if (!trimmed) return err(new RequiredError('metricKey'));

    if (trimmed.length > MetricKey.MAX_LENGTH) {
      return err(new TooLongError('metricKey', MetricKey.MAX_LENGTH, trimmed.length));
    }

    if (!MetricKey.FORMAT.test(trimmed)) {
      return err(
        new InvalidFormatError(
          'metricKey',
          'lowercase letters, digits, underscores, dots; must start with letter',
        ),
      );
    }

    return ok(new MetricKey({ value: trimmed }));
  }

  static reconstitute(value: string): MetricKey {
    return new MetricKey({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
