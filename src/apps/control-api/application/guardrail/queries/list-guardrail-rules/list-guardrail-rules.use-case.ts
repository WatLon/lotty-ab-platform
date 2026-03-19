import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@/shared/application/pagination';
import { err, ForbiddenError, NotFoundError, ok, Result } from '@/shared/domain/common';
import { GuardrailAccessService } from '../../guardrail-access.service';
import { GuardrailRuleOutput } from '../../guardrail-rule.output';
import { GuardrailRuleReadRepository } from '../../guardrail-rule.read-repository';
import { ListGuardrailRulesQuery } from './list-guardrail-rules.query';

@Injectable()
export class ListGuardrailRulesUseCase {
  constructor(
    private readonly guardrailAccessService: GuardrailAccessService,
    private readonly guardrailRuleReadRepository: GuardrailRuleReadRepository,
  ) {}

  async execute(
    query: ListGuardrailRulesQuery,
  ): Promise<Result<PaginatedResult<GuardrailRuleOutput>, NotFoundError | ForbiddenError>> {
    const access = await this.guardrailAccessService.requireExperimentAccess(
      query.actorId,
      query.experimentId,
    );
    if (access.isErr()) return err(access.error);

    const data = await this.guardrailRuleReadRepository.findByExperiment(query.experimentId, {
      limit: query.limit,
      offset: query.offset,
    });
    return ok(data);
  }
}
