import { Injectable } from '@nestjs/common';
import { GuardrailRuleId } from '@/apps/control-api/domain/guardrail';
import { err, ForbiddenError, NotFoundError, ok, Result } from '@/shared/domain/common';
import { GuardrailAccessService } from '../../guardrail-access.service';
import { GuardrailRuleOutput } from '../../guardrail-rule.output';
import { GuardrailRuleReadRepository } from '../../guardrail-rule.read-repository';
import { GetGuardrailRuleQuery } from './get-guardrail-rule.query';

@Injectable()
export class GetGuardrailRuleUseCase {
  constructor(
    private readonly guardrailAccessService: GuardrailAccessService,
    private readonly guardrailRuleReadRepository: GuardrailRuleReadRepository,
  ) {}

  async execute(
    query: GetGuardrailRuleQuery,
  ): Promise<Result<GuardrailRuleOutput, NotFoundError | ForbiddenError>> {
    const access = await this.guardrailAccessService.requireExperimentAccess(
      query.actorId,
      query.experimentId,
    );
    if (access.isErr()) return err(access.error);

    const guardrail = await this.guardrailRuleReadRepository.findByExperimentAndId(
      query.experimentId,
      query.guardrailId,
    );
    if (!guardrail) {
      return err(new NotFoundError('guardrailRule', GuardrailRuleId.from(query.guardrailId)));
    }

    return ok(guardrail);
  }
}
