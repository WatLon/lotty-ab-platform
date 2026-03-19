import { NotificationDeliveryStatus } from '@/apps/control-api/domain/notification';
import { PaginationParams } from '@/shared/application/pagination';

export interface ListNotificationDeliveriesQuery extends PaginationParams {
  ruleId?: string;
  status?: NotificationDeliveryStatus;
}
