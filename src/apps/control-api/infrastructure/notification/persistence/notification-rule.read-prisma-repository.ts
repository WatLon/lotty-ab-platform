import {
  NotificationRule as PrismaNotificationRule,
  NotificationTarget as PrismaNotificationTarget,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationRuleOutput,
  NotificationRuleReadRepository,
} from '@/apps/control-api/application/notification';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { DOMAIN_NOTIFICATION_SCOPE_TYPE_BY_PRISMA_NOTIFICATION_SCOPE_TYPE } from './notification.types';

@Injectable()
export class NotificationRuleReadPrismaRepository implements NotificationRuleReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: PaginationParams): Promise<PaginatedResult<NotificationRuleOutput>> {
    const { limit, offset } = normalizePagination(params);
    const [rows, total] = await Promise.all([
      this.prisma.notificationRule.findMany({
        include: { targets: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationRule.count(),
    ]);
    return {
      data: rows.map((row) => this.toOutput(row)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(
    row: PrismaNotificationRule & {
      targets: PrismaNotificationTarget[];
    },
  ): NotificationRuleOutput {
    return {
      id: row.id,
      name: row.name,
      event: row.event,
      scopeType: DOMAIN_NOTIFICATION_SCOPE_TYPE_BY_PRISMA_NOTIFICATION_SCOPE_TYPE[row.scopeType],
      scopeValue: row.scopeValue,
      metricKey: row.metricKey,
      severity: row.severity,
      environment: row.environment,
      rateLimitCount: row.rateLimitCount,
      rateLimitWindowSec: row.rateLimitWindowSec,
      dedupeWindowSec: row.dedupeWindowSec,
      messageTemplate: row.messageTemplate,
      isEnabled: row.isEnabled,
      targets: row.targets.map((target) => ({
        id: target.id,
        channelId: target.channelId,
        address: target.address,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
