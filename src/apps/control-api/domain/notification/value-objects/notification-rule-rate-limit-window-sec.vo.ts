import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, TooLowError } from '@/shared/domain/common/errors';

interface NotificationRuleRateLimitWindowSecProps {
  value: number;
}

export class NotificationRuleRateLimitWindowSec extends ValueObject<NotificationRuleRateLimitWindowSecProps> {
  static readonly MIN_VALUE = 1;
  private constructor(props: NotificationRuleRateLimitWindowSecProps) {
    super(props);
  }

  static create(
    value: number,
  ): Result<NotificationRuleRateLimitWindowSec, InvalidFormatError | TooLowError> {
    if (!Number.isInteger(value)) {
      return err(new InvalidFormatError('rateLimitWindowSec', 'integer'));
    }

    if (value < NotificationRuleRateLimitWindowSec.MIN_VALUE) {
      return err(
        new TooLowError('rateLimitWindowSec', NotificationRuleRateLimitWindowSec.MIN_VALUE, value),
      );
    }

    return ok(new NotificationRuleRateLimitWindowSec({ value }));
  }

  static reconstitute(value: number): NotificationRuleRateLimitWindowSec {
    return new NotificationRuleRateLimitWindowSec({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
