import { NotificationChannel as PrismaNotificationChannel } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationChannelId } from '@/apps/control-api/domain/notification';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';
import { DOMAIN_NOTIFICATION_CHANNEL_TYPE_BY_PRISMA_NOTIFICATION_CHANNEL_TYPE } from './notification.types';

@Injectable()
export class NotificationChannelMapper
  implements PersistenceMapper<NotificationChannel, PrismaNotificationChannel>
{
  toDomain(raw: PrismaNotificationChannel): NotificationChannel {
    return NotificationChannel.reconstitute(
      {
        name: raw.name,
        type: DOMAIN_NOTIFICATION_CHANNEL_TYPE_BY_PRISMA_NOTIFICATION_CHANNEL_TYPE[raw.type],
        config: raw.config,
        isEnabled: raw.isEnabled,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      NotificationChannelId.from(raw.id),
    );
  }
}
