import { StringId } from '@/shared/domain/common';

export class NotificationTargetId extends StringId {
  protected readonly _brand = 'NotificationTargetId';
  static generate(): NotificationTargetId {
    return new NotificationTargetId(crypto.randomUUID());
  }

  static from(value: string): NotificationTargetId {
    return new NotificationTargetId(value);
  }
}
