import { ConcurrencyError, Result } from '@/shared/domain/common';
import { NotificationChannel } from './notification-channel.aggregate-root';
import { NotificationChannelId } from './notification-channel.id';

export abstract class NotificationChannelRepository {
  abstract findById(id: NotificationChannelId): Promise<NotificationChannel | null>;

  abstract save(channel: NotificationChannel): Promise<Result<void, ConcurrencyError>>;
}
