import { NotificationChannelType } from '@/apps/control-api/domain/notification';

export interface NotificationChannelOutput {
  id: string;
  name: string;
  type: NotificationChannelType;
  config: unknown;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
