import { BusinessRuleError } from '@/shared/domain/common';
import { GuardrailErrorCode } from './codes';

export interface GuardrailRuleAlreadyExistsMetadata {
  experimentId?: string;
  guardrailId?: string;
  metricId?: string;
  threshold?: number;
  operator?: string;
  windowMinutes?: number;
  action?: string;
}

export class GuardrailRuleAlreadyExistsError extends BusinessRuleError {
  readonly code = GuardrailErrorCode.GUARDRAIL_RULE_ALREADY_EXISTS;

  constructor(public readonly metadata: GuardrailRuleAlreadyExistsMetadata) {
    super('Guardrail rule with the same settings already exists');
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
