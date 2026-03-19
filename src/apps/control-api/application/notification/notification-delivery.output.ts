import { NotificationDeliveryStatus } from '@/apps/control-api/domain/notification';

export interface NotificationDeliveryOutput {
  id: string;
  sourceEventId: string;
  ruleId: string;
  targetId: string;
  channelId: string;
  status: NotificationDeliveryStatus;
  payload: unknown;
  response: unknown;
  errorMessage: string | null;
  attempt: number;
  createdAt: Date;
  sentAt: Date | null;
}
