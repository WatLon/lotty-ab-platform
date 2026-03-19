import { NotificationScopeType } from '@/apps/control-api/domain/notification';

export interface NotificationRuleTargetOutput {
  id: string;
  channelId: string;
  address: string | null;
}

export interface NotificationRuleOutput {
  id: string;
  name: string;
  event: string;
  scopeType: NotificationScopeType;
  scopeValue: string | null;
  metricKey: string | null;
  severity: string | null;
  environment: string | null;
  rateLimitCount: number;
  rateLimitWindowSec: number;
  dedupeWindowSec: number;
  messageTemplate: string | null;
  isEnabled: boolean;
  targets: NotificationRuleTargetOutput[];
  createdAt: Date;
  updatedAt: Date;
}
