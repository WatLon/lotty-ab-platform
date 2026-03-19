import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, TooLowError } from '@/shared/domain/common/errors';

interface NotificationRuleDedupeWindowSecProps {
  value: number;
}

export class NotificationRuleDedupeWindowSec extends ValueObject<NotificationRuleDedupeWindowSecProps> {
  static readonly MIN_VALUE = 1;
  private constructor(props: NotificationRuleDedupeWindowSecProps) {
    super(props);
  }

  static create(
    value: number,
  ): Result<NotificationRuleDedupeWindowSec, InvalidFormatError | TooLowError> {
    if (!Number.isInteger(value)) {
      return err(new InvalidFormatError('dedupeWindowSec', 'integer'));
    }

    if (value < NotificationRuleDedupeWindowSec.MIN_VALUE) {
      return err(
        new TooLowError('dedupeWindowSec', NotificationRuleDedupeWindowSec.MIN_VALUE, value),
      );
    }

    return ok(new NotificationRuleDedupeWindowSec({ value }));
  }

  static reconstitute(value: number): NotificationRuleDedupeWindowSec {
    return new NotificationRuleDedupeWindowSec({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
