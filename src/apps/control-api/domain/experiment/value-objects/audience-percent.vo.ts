import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { TooHighError, TooLowError } from '@/shared/domain/common/errors';

interface AudiencePercentProps {
  value: number;
}

export class AudiencePercent extends ValueObject<AudiencePercentProps> {
  static readonly MIN_VALUE = 1;
  static readonly MAX_VALUE = 100;
  private constructor(props: AudiencePercentProps) {
    super(props);
  }

  static create(value: number): Result<AudiencePercent, TooLowError | TooHighError> {
    if (value < AudiencePercent.MIN_VALUE) {
      return err(new TooLowError('audiencePercent', AudiencePercent.MIN_VALUE, value));
    }

    if (value > AudiencePercent.MAX_VALUE) {
      return err(new TooHighError('audiencePercent', AudiencePercent.MAX_VALUE, value));
    }

    return ok(new AudiencePercent({ value }));
  }

  static reconstitute(value: number): AudiencePercent {
    return new AudiencePercent({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
