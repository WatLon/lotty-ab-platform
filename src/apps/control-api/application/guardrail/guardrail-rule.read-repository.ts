import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { GuardrailRuleOutput } from './guardrail-rule.output';

export abstract class GuardrailRuleReadRepository {
  abstract findByExperimentAndId(
    experimentId: string,
    guardrailId: string,
  ): Promise<GuardrailRuleOutput | null>;

  abstract findByExperiment(
    experimentId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<GuardrailRuleOutput>>;
}
