import { NotificationDeliveryStatus } from '@/apps/control-api/domain/notification';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { NotificationDeliveryOutput } from './notification-delivery.output';

export interface NotificationDeliveryFilters {
  ruleId?: string;
  status?: NotificationDeliveryStatus;
}

export abstract class NotificationDeliveryReadRepository {
  abstract findAll(
    params: PaginationParams,
    filters?: NotificationDeliveryFilters,
  ): Promise<PaginatedResult<NotificationDeliveryOutput>>;
}
