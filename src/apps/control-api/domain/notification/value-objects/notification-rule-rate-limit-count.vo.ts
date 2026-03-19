import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, TooLowError } from '@/shared/domain/common/errors';

interface NotificationRuleRateLimitCountProps {
  value: number;
}

export class NotificationRuleRateLimitCount extends ValueObject<NotificationRuleRateLimitCountProps> {
  static readonly MIN_VALUE = 1;
  private constructor(props: NotificationRuleRateLimitCountProps) {
    super(props);
  }

  static create(
    value: number,
  ): Result<NotificationRuleRateLimitCount, InvalidFormatError | TooLowError> {
    if (!Number.isInteger(value)) {
      return err(new InvalidFormatError('rateLimitCount', 'integer'));
    }

    if (value < NotificationRuleRateLimitCount.MIN_VALUE) {
      return err(
        new TooLowError('rateLimitCount', NotificationRuleRateLimitCount.MIN_VALUE, value),
      );
    }

    return ok(new NotificationRuleRateLimitCount({ value }));
  }

  static reconstitute(value: number): NotificationRuleRateLimitCount {
    return new NotificationRuleRateLimitCount({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
