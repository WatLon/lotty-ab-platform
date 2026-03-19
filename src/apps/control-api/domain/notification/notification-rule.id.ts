import { StringId } from '@/shared/domain/common';

export class NotificationRuleId extends StringId {
  protected readonly _brand = 'NotificationRuleId';
  static generate(): NotificationRuleId {
    return new NotificationRuleId(crypto.randomUUID());
  }

  static from(value: string): NotificationRuleId {
    return new NotificationRuleId(value);
  }
}
