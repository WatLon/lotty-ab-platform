import { GuardrailAction } from '@/apps/control-api/domain/guardrail';

export interface GuardrailTriggerOutput {
  id: string;
  guardrailId: string;
  metricValue: number;
  threshold: number;
  actionTaken: GuardrailAction;
  triggeredAt: Date;
}
