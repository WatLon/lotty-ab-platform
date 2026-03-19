export interface UpdateNotificationChannelCommand {
  actorId: string;
  channelId: string;
  name?: string;
  config?: unknown;
  isEnabled?: boolean;
}
