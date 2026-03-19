import { Injectable } from '@nestjs/common';
import { GuardrailRuleId, GuardrailRuleRepository } from '@/apps/control-api/domain/guardrail';
import { TransactionManager } from '@/shared/application';
import { err, ForbiddenError, NotFoundError, ok, Result } from '@/shared/domain/common';
import { GuardrailAccessService } from '../../guardrail-access.service';
import { DeleteGuardrailRuleCommand } from './delete-guardrail-rule.command';

@Injectable()
export class DeleteGuardrailRuleUseCase {
  constructor(
    private readonly guardrailAccessService: GuardrailAccessService,
    private readonly guardrailRuleRepository: GuardrailRuleRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: DeleteGuardrailRuleCommand,
  ): Promise<Result<void, NotFoundError | ForbiddenError>> {
    return this.transactionManager.execute(async () => {
      const access = await this.guardrailAccessService.requireExperimentAccess(
        command.actorId,
        command.experimentId,
      );
      if (access.isErr()) return err(access.error);

      const guardrailId = GuardrailRuleId.from(command.guardrailId);
      const guardrail = await this.guardrailRuleRepository.findById(guardrailId);
      if (!guardrail || guardrail.experimentId !== command.experimentId) {
        return err(new NotFoundError('guardrailRule', guardrailId));
      }

      const deleted = await this.guardrailRuleRepository.delete(guardrailId);
      if (!deleted) {
        return err(new NotFoundError('guardrailRule', guardrailId));
      }

      return ok(undefined);
    });
  }
}
