import { NotificationChannel as PrismaNotificationChannel } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  NotificationChannelOutput,
  NotificationChannelReadRepository,
} from '@/apps/control-api/application/notification';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { DOMAIN_NOTIFICATION_CHANNEL_TYPE_BY_PRISMA_NOTIFICATION_CHANNEL_TYPE } from './notification.types';

@Injectable()
export class NotificationChannelReadPrismaRepository implements NotificationChannelReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: PaginationParams): Promise<PaginatedResult<NotificationChannelOutput>> {
    const { limit, offset } = normalizePagination(params);

    const [rows, total] = await Promise.all([
      this.prisma.notificationChannel.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationChannel.count(),
    ]);

    return {
      data: rows.map((row) => this.toOutput(row)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(row: PrismaNotificationChannel): NotificationChannelOutput {
    return {
      id: row.id,
      name: row.name,
      type: DOMAIN_NOTIFICATION_CHANNEL_TYPE_BY_PRISMA_NOTIFICATION_CHANNEL_TYPE[row.type],
      config: row.config,
      isEnabled: row.isEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
