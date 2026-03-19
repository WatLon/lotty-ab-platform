import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';

export interface UpdateGuardrailRuleCommand {
  actorId: string;
  experimentId: string;
  guardrailId: string;
  metricId?: string;
  threshold?: number;
  operator?: ComparisonOperator;
  windowMinutes?: number;
  action?: GuardrailAction;
}
