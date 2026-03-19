import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { NotificationDeliveryOutput } from '../../notification-delivery.output';
import { NotificationDeliveryReadRepository } from '../../notification-delivery.read-repository';
import { ListNotificationDeliveriesQuery } from './list-notification-deliveries.query';

@Injectable()
export class ListNotificationDeliveriesUseCase {
  constructor(private readonly deliveries: NotificationDeliveryReadRepository) {}

  async execute(
    query: ListNotificationDeliveriesQuery,
  ): Promise<Result<PaginatedResult<NotificationDeliveryOutput>, never>> {
    return ok(
      await this.deliveries.findAll(
        {
          limit: query.limit,
          offset: query.offset,
        },
        {
          ruleId: query.ruleId,
          status: query.status,
        },
      ),
    );
  }
}
