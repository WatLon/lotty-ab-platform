import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';

export interface CreateGuardrailRuleCommand {
  actorId: string;
  experimentId: string;
  metricId: string;
  threshold: number;
  operator: ComparisonOperator;
  windowMinutes: number;
  action: GuardrailAction;
}
