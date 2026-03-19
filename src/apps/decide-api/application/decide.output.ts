import { DecisionReason } from '@/apps/decide-api/domain';

export interface FlagDecisionOutput {
  flagKey: string;
  value: string;
  decisionId: string;
  reason: DecisionReason;
  experimentId: string | null;
  variantId: string | null;
}
