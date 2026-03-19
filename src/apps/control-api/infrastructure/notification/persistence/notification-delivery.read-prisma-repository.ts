import { NotificationDelivery as PrismaNotificationDelivery } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationDeliveryFilters,
  NotificationDeliveryOutput,
  NotificationDeliveryReadRepository,
} from '@/apps/control-api/application/notification';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';
import {
  DOMAIN_NOTIFICATION_DELIVERY_STATUS_BY_PRISMA_NOTIFICATION_DELIVERY_STATUS,
  PRISMA_NOTIFICATION_DELIVERY_STATUS_BY_DOMAIN_NOTIFICATION_DELIVERY_STATUS,
} from './notification.types';

@Injectable()
export class NotificationDeliveryReadPrismaRepository
  implements NotificationDeliveryReadRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    params: PaginationParams,
    filters?: NotificationDeliveryFilters,
  ): Promise<PaginatedResult<NotificationDeliveryOutput>> {
    const { limit, offset } = normalizePagination(params);

    const where = {
      ...(filters?.ruleId ? { ruleId: filters.ruleId } : {}),
      ...(filters?.status
        ? {
            status:
              PRISMA_NOTIFICATION_DELIVERY_STATUS_BY_DOMAIN_NOTIFICATION_DELIVERY_STATUS[
                filters.status
              ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toOutput(row)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(row: PrismaNotificationDelivery): NotificationDeliveryOutput {
    return {
      id: row.id,
      sourceEventId: row.sourceEventId,
      ruleId: row.ruleId,
      targetId: row.targetId,
      channelId: row.channelId,
      status:
        DOMAIN_NOTIFICATION_DELIVERY_STATUS_BY_PRISMA_NOTIFICATION_DELIVERY_STATUS[row.status],
      payload: row.payload,
      response: row.response,
      errorMessage: row.errorMessage,
      attempt: row.attempt,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
    };
  }
}
