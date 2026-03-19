import { NotificationScopeType } from '@/apps/control-api/domain/notification';

export interface CreateNotificationRuleTargetInput {
  channelId: string;
  address: string | null;
}

export interface CreateNotificationRuleCommand {
  actorId: string;
  name: string;
  event: string;
  scopeType: NotificationScopeType | null;
  scopeValue: string | null;
  metricKey: string | null;
  severity: string | null;
  environment: string | null;
  rateLimitCount: number | null;
  rateLimitWindowSec: number | null;
  dedupeWindowSec: number | null;
  messageTemplate: string | null;
  isEnabled: boolean | null;
  targets: CreateNotificationRuleTargetInput[];
}
