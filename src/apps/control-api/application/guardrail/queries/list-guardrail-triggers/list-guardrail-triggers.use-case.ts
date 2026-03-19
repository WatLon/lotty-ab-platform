import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@/shared/application/pagination';
import { err, ForbiddenError, NotFoundError, ok, Result } from '@/shared/domain/common';
import { GuardrailAccessService } from '../../guardrail-access.service';
import { GuardrailTriggerOutput } from '../../guardrail-trigger.output';
import { GuardrailTriggerReadRepository } from '../../guardrail-trigger.read-repository';
import { ListGuardrailTriggersQuery } from './list-guardrail-triggers.query';

@Injectable()
export class ListGuardrailTriggersUseCase {
  constructor(
    private readonly guardrailAccessService: GuardrailAccessService,
    private readonly guardrailTriggerReadRepository: GuardrailTriggerReadRepository,
  ) {}

  async execute(
    query: ListGuardrailTriggersQuery,
  ): Promise<Result<PaginatedResult<GuardrailTriggerOutput>, NotFoundError | ForbiddenError>> {
    const access = await this.guardrailAccessService.requireExperimentAccess(
      query.actorId,
      query.experimentId,
    );
    if (access.isErr()) return err(access.error);

    const data = await this.guardrailTriggerReadRepository.findByExperiment(
      query.experimentId,
      {
        limit: query.limit,
        offset: query.offset,
      },
      {
        guardrailId: query.guardrailId,
        actionTaken: query.actionTaken,
      },
    );
    return ok(data);
  }
}
