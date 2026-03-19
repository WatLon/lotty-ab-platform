import { NotificationChannelType } from '@/apps/control-api/domain/notification';

export interface CreateNotificationChannelCommand {
  actorId: string;
  name: string;
  type: NotificationChannelType;
  config: unknown;
  isEnabled: boolean | null;
}
