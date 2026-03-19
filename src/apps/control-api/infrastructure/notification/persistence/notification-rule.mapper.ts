import {
  NotificationRule as PrismaNotificationRule,
  NotificationTarget as PrismaNotificationTarget,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationChannelId,
  NotificationRule,
  NotificationRuleDedupeWindowSec,
  NotificationRuleId,
  NotificationRuleName,
  NotificationRuleRateLimitCount,
  NotificationRuleRateLimitWindowSec,
  NotificationRuleText,
  NotificationTargetId,
} from '@/apps/control-api/domain/notification';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';
import { DOMAIN_NOTIFICATION_SCOPE_TYPE_BY_PRISMA_NOTIFICATION_SCOPE_TYPE } from './notification.types';
export type PrismaNotificationRuleRecord = PrismaNotificationRule & {
  targets: PrismaNotificationTarget[];
};

@Injectable()
export class NotificationRuleMapper
  implements PersistenceMapper<NotificationRule, PrismaNotificationRuleRecord>
{
  toDomain(raw: PrismaNotificationRuleRecord): NotificationRule {
    return NotificationRule.reconstitute(
      {
        name: NotificationRuleName.reconstitute(raw.name),
        event: raw.event,
        scopeType: DOMAIN_NOTIFICATION_SCOPE_TYPE_BY_PRISMA_NOTIFICATION_SCOPE_TYPE[raw.scopeType],
        scopeValue:
          raw.scopeValue === null ? null : NotificationRuleText.reconstitute(raw.scopeValue),
        metricKey: raw.metricKey === null ? null : NotificationRuleText.reconstitute(raw.metricKey),
        severity: raw.severity === null ? null : NotificationRuleText.reconstitute(raw.severity),
        environment:
          raw.environment === null ? null : NotificationRuleText.reconstitute(raw.environment),
        rateLimitCount: NotificationRuleRateLimitCount.reconstitute(raw.rateLimitCount),
        rateLimitWindowSec: NotificationRuleRateLimitWindowSec.reconstitute(raw.rateLimitWindowSec),
        dedupeWindowSec: NotificationRuleDedupeWindowSec.reconstitute(raw.dedupeWindowSec),
        messageTemplate:
          raw.messageTemplate === null
            ? null
            : NotificationRuleText.reconstitute(raw.messageTemplate),
        isEnabled: raw.isEnabled,
        targets: raw.targets.map((target) => ({
          id: NotificationTargetId.from(target.id),
          channelId: NotificationChannelId.from(target.channelId),
          address: target.address,
        })),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      NotificationRuleId.from(raw.id),
    );
  }
}
