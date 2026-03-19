import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError } from '@/shared/domain/common/errors';

interface NotificationRuleTextProps {
  value: string;
}

export type NotificationRuleTextField =
  | 'scopeValue'
  | 'metricKey'
  | 'severity'
  | 'environment'
  | 'messageTemplate';

export class NotificationRuleText extends ValueObject<NotificationRuleTextProps> {
  private constructor(props: NotificationRuleTextProps) {
    super(props);
  }

  static create(
    value: string,
    field: NotificationRuleTextField,
  ): Result<NotificationRuleText, RequiredError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError(field));
    }

    return ok(new NotificationRuleText({ value: trimmed }));
  }

  static reconstitute(value: string): NotificationRuleText {
    return new NotificationRuleText({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
