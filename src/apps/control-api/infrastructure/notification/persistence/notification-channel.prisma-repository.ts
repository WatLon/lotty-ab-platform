import { NotificationChannel as PrismaNotificationChannel } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationChannelId,
  NotificationChannelRepository,
} from '@/apps/control-api/domain/notification';
import { AppLogger } from '@/shared/application';
import { ok, Result } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
  toPrismaJson,
} from '@/shared/infrastructure/persistence';
import { PRISMA_NOTIFICATION_CHANNEL_TYPE_BY_DOMAIN_NOTIFICATION_CHANNEL_TYPE } from './notification.types';
import { NotificationChannelMapper } from './notification-channel.mapper';

@Injectable()
export class NotificationChannelPrismaRepository
  extends PrismaRepositoryBase<
    NotificationChannel,
    PrismaNotificationChannel,
    NotificationChannelId
  >
  implements NotificationChannelRepository
{
  protected readonly entityName = 'NotificationChannel';

  constructor(
    txManager: PrismaTransactionManager,
    mapper: NotificationChannelMapper,
    private readonly appLogger: AppLogger,
  ) {
    super(txManager, mapper);
  }

  async findById(id: NotificationChannelId): Promise<NotificationChannel | null> {
    return this.findOne(this.client.notificationChannel.findUnique({ where: { id: id.value } }));
  }

  protected async doCreate(
    entity: NotificationChannel,
    version: number,
  ): Promise<Result<void, never>> {
    await this.client.notificationChannel.create({
      data: {
        id: entity.id.value,
        name: entity.name,
        type: PRISMA_NOTIFICATION_CHANNEL_TYPE_BY_DOMAIN_NOTIFICATION_CHANNEL_TYPE[entity.type],
        config: toPrismaJson(entity.config, 'NotificationChannel.config must be JSON-serializable'),
        isEnabled: entity.isEnabled,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? new Date(),
        version,
      },
    });
    return ok(undefined);
  }

  protected async doUpdate(
    entity: NotificationChannel,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, never>> {
    const updated = await prismaUpdateWithOptimisticLock({
      appLogger: this.appLogger,
      operation: 'NotificationChannelPrismaRepository.doUpdate',
      entity: this.entityName,
      entityId: entity.id.value,
      currentVersion,
      newVersion,
      update: async () => {
        await this.client.notificationChannel.update({
          where: {
            id: entity.id.value,
            version: currentVersion,
          },
          data: {
            name: entity.name,
            config: toPrismaJson(
              entity.config,
              'NotificationChannel.config must be JSON-serializable',
            ),
            isEnabled: entity.isEnabled,
            updatedAt: entity.updatedAt ?? new Date(),
            version: newVersion,
          },
        });
      },
    });

    return ok(updated);
  }
}
