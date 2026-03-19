import {
  ComparisonOperator as DomainComparisonOperator,
  GuardrailAction as DomainGuardrailAction,
} from '@/apps/control-api/domain/guardrail';

export interface GuardrailBreach {
  ruleId: string;
  threshold: number;
  action: DomainGuardrailAction;
  operator: DomainComparisonOperator;
  metricKey: string;
  metricValue: number;
  windowMinutes: number;
}
