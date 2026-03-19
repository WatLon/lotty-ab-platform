import { GuardrailAction } from '@/apps/control-api/domain/guardrail';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { GuardrailTriggerOutput } from './guardrail-trigger.output';

export interface GuardrailTriggerFilters {
  guardrailId?: string;
  actionTaken?: GuardrailAction;
}

export abstract class GuardrailTriggerReadRepository {
  abstract findByExperiment(
    experimentId: string,
    params: PaginationParams,
    filters?: GuardrailTriggerFilters,
  ): Promise<PaginatedResult<GuardrailTriggerOutput>>;
}
