import { StringId } from '@/shared/domain/common';

export class NotificationChannelId extends StringId {
  protected readonly _brand = 'NotificationChannelId';
  static generate(): NotificationChannelId {
    return new NotificationChannelId(crypto.randomUUID());
  }

  static from(value: string): NotificationChannelId {
    return new NotificationChannelId(value);
  }
}
