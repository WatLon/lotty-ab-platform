import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface NotificationRuleNameProps {
  value: string;
}

export class NotificationRuleName extends ValueObject<NotificationRuleNameProps> {
  static readonly MAX_LENGTH = 128;
  private constructor(props: NotificationRuleNameProps) {
    super(props);
  }

  static create(value: string): Result<NotificationRuleName, RequiredError | TooLongError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError('name'));
    }

    if (trimmed.length > NotificationRuleName.MAX_LENGTH) {
      return err(new TooLongError('name', NotificationRuleName.MAX_LENGTH, trimmed.length));
    }

    return ok(new NotificationRuleName({ value: trimmed }));
  }

  static reconstitute(value: string): NotificationRuleName {
    return new NotificationRuleName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
