import { ConcurrencyError, Result } from '@/shared/domain/common';
import { GuardrailRuleAlreadyExistsError } from './errors';
import { GuardrailRule } from './guardrail-rule.aggregate-root';
import { GuardrailRuleId } from './guardrail-rule.id';

export abstract class GuardrailRuleRepository {
  abstract findById(id: GuardrailRuleId): Promise<GuardrailRule | null>;

  abstract findByExperimentId(experimentId: string): Promise<GuardrailRule[]>;

  abstract save(
    entity: GuardrailRule,
  ): Promise<Result<void, ConcurrencyError | GuardrailRuleAlreadyExistsError>>;

  abstract delete(id: GuardrailRuleId): Promise<boolean>;
}
