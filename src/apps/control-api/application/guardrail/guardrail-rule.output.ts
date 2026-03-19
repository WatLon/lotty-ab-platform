import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';

export interface GuardrailRuleOutput {
  id: string;
  experimentId: string;
  metricId: string;
  metricKey: string;
  metricName: string;
  threshold: number;
  operator: ComparisonOperator;
  windowMinutes: number;
  action: GuardrailAction;
  createdAt: Date;
}
