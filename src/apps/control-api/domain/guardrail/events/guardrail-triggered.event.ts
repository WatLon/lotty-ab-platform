import { DomainEvent, DomainEventProps } from '@/shared/domain/common';
import { ComparisonOperator } from '../enums/comparison-operator.enum';
import { GuardrailAction } from '../enums/guardrail-action.enum';

export interface GuardrailTriggeredBreachPayload {
  ruleId: string;
  metricKey: string;
  metricValue: number;
  threshold: number;
  operator: ComparisonOperator;
  windowMinutes: number;
}

export interface GuardrailTriggeredPayload {
  action: GuardrailAction;
  metricKeys: string[];
  breaches: GuardrailTriggeredBreachPayload[];
}

export class GuardrailTriggered extends DomainEvent {
  readonly aggregateType = 'Experiment';
  readonly eventName = 'GuardrailTriggered';

  constructor(
    props: DomainEventProps,
    public readonly payload: GuardrailTriggeredPayload,
  ) {
    super(props);
  }
}
