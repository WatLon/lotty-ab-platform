import { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationRule,
  NotificationRuleId,
  NotificationRuleRepository,
} from '@/apps/control-api/domain/notification';
import { AppLogger } from '@/shared/application';
import { ok, Result } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
} from '@/shared/infrastructure/persistence';
import { PRISMA_NOTIFICATION_SCOPE_TYPE_BY_DOMAIN_NOTIFICATION_SCOPE_TYPE } from './notification.types';
import { NotificationRuleMapper, PrismaNotificationRuleRecord } from './notification-rule.mapper';

@Injectable()
export class NotificationRulePrismaRepository
  extends PrismaRepositoryBase<NotificationRule, PrismaNotificationRuleRecord, NotificationRuleId>
  implements NotificationRuleRepository
{
  protected readonly entityName = 'NotificationRule';

  constructor(
    txManager: PrismaTransactionManager,
    mapper: NotificationRuleMapper,
    private readonly appLogger: AppLogger,
  ) {
    super(txManager, mapper);
  }

  async findById(id: NotificationRuleId): Promise<NotificationRule | null> {
    return this.findOne(
      this.client.notificationRule.findUnique({
        where: { id: id.value },
        include: { targets: true },
      }),
    );
  }

  protected async doCreate(
    entity: NotificationRule,
    version: number,
  ): Promise<Result<void, never>> {
    await this.client.notificationRule.create({
      data: {
        id: entity.id.value,
        name: entity.name,
        event: entity.event,
        scopeType:
          PRISMA_NOTIFICATION_SCOPE_TYPE_BY_DOMAIN_NOTIFICATION_SCOPE_TYPE[entity.scopeType],
        scopeValue: entity.scopeValue,
        metricKey: entity.metricKey,
        severity: entity.severity ?? 'info',
        environment: entity.environment,
        rateLimitCount: entity.rateLimitCount,
        rateLimitWindowSec: entity.rateLimitWindowSec,
        dedupeWindowSec: entity.dedupeWindowSec,
        messageTemplate: entity.messageTemplate,
        isEnabled: entity.isEnabled,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? new Date(),
        version,
        targets: {
          createMany: {
            data: this.toTargetRows(entity.targets),
          },
        },
      },
    });
    return ok(undefined);
  }

  protected async doUpdate(
    entity: NotificationRule,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, never>> {
    const updated = await prismaUpdateWithOptimisticLock({
      appLogger: this.appLogger,
      operation: 'NotificationRulePrismaRepository.doUpdate',
      entity: this.entityName,
      entityId: entity.id.value,
      currentVersion,
      newVersion,
      update: async () => {
        await this.client.notificationRule.update({
          where: {
            id: entity.id.value,
            version: currentVersion,
          },
          data: {
            name: entity.name,
            event: entity.event,
            scopeType:
              PRISMA_NOTIFICATION_SCOPE_TYPE_BY_DOMAIN_NOTIFICATION_SCOPE_TYPE[entity.scopeType],
            scopeValue: entity.scopeValue,
            metricKey: entity.metricKey,
            severity: entity.severity ?? 'info',
            environment: entity.environment,
            rateLimitCount: entity.rateLimitCount,
            rateLimitWindowSec: entity.rateLimitWindowSec,
            dedupeWindowSec: entity.dedupeWindowSec,
            messageTemplate: entity.messageTemplate,
            isEnabled: entity.isEnabled,
            updatedAt: entity.updatedAt ?? new Date(),
            version: newVersion,
            targets: {
              deleteMany: {},
              createMany: {
                data: this.toTargetRows(entity.targets),
              },
            },
          },
        });
      },
    });
    return ok(updated);
  }

  private toTargetRows(
    targets: ReadonlyArray<NotificationRule['targets'][number]>,
  ): Array<Prisma.NotificationTargetCreateManyRuleInput> {
    return targets.map((target) => ({
      id: target.id.value,
      channelId: target.channelId.value,
      address: target.address,
    }));
  }
}
