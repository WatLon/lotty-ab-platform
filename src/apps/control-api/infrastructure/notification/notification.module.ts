import { Module } from '@nestjs/common';
import {
  CreateNotificationChannelUseCase,
  CreateNotificationRuleUseCase,
  ListNotificationChannelsUseCase,
  ListNotificationDeliveriesUseCase,
  ListNotificationRulesUseCase,
  NotificationChannelReadRepository,
  NotificationDeliveryReadRepository,
  NotificationRuleReadRepository,
  UpdateNotificationChannelUseCase,
  UpdateNotificationRuleUseCase,
} from '@/apps/control-api/application/notification';
import {
  NotificationChannelRepository,
  NotificationRuleRepository,
} from '@/apps/control-api/domain/notification';
import { UserModule } from '@/apps/control-api/infrastructure/user';
import { NotificationController } from '@/apps/control-api/presentation/notification/notification.controller';
import { NotificationChannelMapper } from './persistence/notification-channel.mapper';
import { NotificationChannelPrismaRepository } from './persistence/notification-channel.prisma-repository';
import { NotificationChannelReadPrismaRepository } from './persistence/notification-channel.read-prisma-repository';
import { NotificationDeliveryReadPrismaRepository } from './persistence/notification-delivery.read-prisma-repository';
import { NotificationRuleMapper } from './persistence/notification-rule.mapper';
import { NotificationRulePrismaRepository } from './persistence/notification-rule.prisma-repository';
import { NotificationRuleReadPrismaRepository } from './persistence/notification-rule.read-prisma-repository';

@Module({
  imports: [UserModule],
  controllers: [NotificationController],
  providers: [
    CreateNotificationChannelUseCase,
    UpdateNotificationChannelUseCase,
    CreateNotificationRuleUseCase,
    UpdateNotificationRuleUseCase,
    ListNotificationChannelsUseCase,
    ListNotificationRulesUseCase,
    ListNotificationDeliveriesUseCase,
    NotificationChannelMapper,
    NotificationRuleMapper,
    {
      provide: NotificationChannelRepository,
      useClass: NotificationChannelPrismaRepository,
    },
    {
      provide: NotificationRuleRepository,
      useClass: NotificationRulePrismaRepository,
    },
    {
      provide: NotificationChannelReadRepository,
      useClass: NotificationChannelReadPrismaRepository,
    },
    {
      provide: NotificationRuleReadRepository,
      useClass: NotificationRuleReadPrismaRepository,
    },
    {
      provide: NotificationDeliveryReadRepository,
      useClass: NotificationDeliveryReadPrismaRepository,
    },
  ],
  exports: [NotificationChannelRepository, NotificationRuleRepository],
})
export class NotificationModule {}
