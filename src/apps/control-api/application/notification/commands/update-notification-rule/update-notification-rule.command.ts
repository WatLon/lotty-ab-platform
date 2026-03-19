import { NotificationScopeType } from '@/apps/control-api/domain/notification';

export interface UpdateNotificationRuleTargetInput {
  channelId: string;
  address?: string | null;
}

export interface UpdateNotificationRuleCommand {
  actorId: string;
  ruleId: string;
  name?: string;
  event?: string;
  scopeType?: NotificationScopeType;
  scopeValue?: string | null;
  metricKey?: string | null;
  severity?: string | null;
  environment?: string | null;
  rateLimitCount?: number;
  rateLimitWindowSec?: number;
  dedupeWindowSec?: number;
  messageTemplate?: string | null;
  isEnabled?: boolean;
  targets?: UpdateNotificationRuleTargetInput[];
}
