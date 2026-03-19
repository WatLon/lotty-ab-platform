import { Injectable } from '@nestjs/common';
import {
  GuardrailRule,
  GuardrailRuleAlreadyExistsError,
  GuardrailRuleId,
  GuardrailRuleRepository,
} from '@/apps/control-api/domain/guardrail';
import { MetricArchivedError, MetricId, MetricRepository } from '@/apps/control-api/domain/metric';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Result,
  ValidationErrors,
} from '@/shared/domain/common';
import { GuardrailAccessContext, GuardrailAccessService } from '../../guardrail-access.service';
import { UpdateGuardrailRuleCommand } from './update-guardrail-rule.command';

type UpdateGuardrailRuleError =
  | NotFoundError
  | ForbiddenError
  | MetricArchivedError
  | GuardrailRuleAlreadyExistsError
  | ValidationErrors
  | ConcurrencyError;

@Injectable()
export class UpdateGuardrailRuleUseCase {
  constructor(
    private readonly guardrailAccessService: GuardrailAccessService,
    private readonly metricRepository: MetricRepository,
    private readonly guardrailRuleRepository: GuardrailRuleRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateGuardrailRuleCommand,
  ): Promise<Result<void, UpdateGuardrailRuleError>> {
    return this.transactionManager.execute(async () => {
      const accessResult = await this.guardrailAccessService.requireExperimentAccess(
        command.actorId,
        command.experimentId,
      );

      if (accessResult.isErr()) {
        return err(accessResult.error);
      }

      const accessContext = accessResult.value;
      const guardrailId = GuardrailRuleId.from(command.guardrailId);
      const guardrailResult = await this.findGuardrailWithinExperiment(
        guardrailId,
        command.experimentId,
      );

      if (guardrailResult.isErr()) {
        return err(guardrailResult.error);
      }

      const guardrail = guardrailResult.value;
      const metricValidationResult = await this.validateMetricUpdate(command, accessContext);

      if (metricValidationResult.isErr()) {
        return err(metricValidationResult.error);
      }

      const applyPatchResult = this.applyCommandPatch(guardrail, command);

      if (applyPatchResult.isErr()) {
        return err(applyPatchResult.error);
      }

      const saveResult = await this.guardrailRuleRepository.save(guardrail);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }

  private async findGuardrailWithinExperiment(
    guardrailId: GuardrailRuleId,
    experimentId: string,
  ): Promise<Result<GuardrailRule, NotFoundError>> {
    const guardrail = await this.guardrailRuleRepository.findById(guardrailId);
    if (!guardrail || guardrail.experimentId !== experimentId) {
      return err(new NotFoundError('guardrailRule', guardrailId));
    }
    return ok(guardrail);
  }

  private async validateMetricUpdate(
    command: UpdateGuardrailRuleCommand,
    accessContext: GuardrailAccessContext,
  ): Promise<Result<void, NotFoundError | MetricArchivedError>> {
    if (command.metricId === undefined) {
      return ok(undefined);
    }

    const metricId = MetricId.from(command.metricId);

    if (!accessContext.experiment.metricIds.includes(command.metricId)) {
      return err(new NotFoundError('metric', metricId));
    }

    const metric = await this.metricRepository.findById(metricId);

    if (!metric) {
      return err(new NotFoundError('metric', metricId));
    }

    if (metric.isArchived) {
      return err(new MetricArchivedError(metricId));
    }

    return ok(undefined);
  }

  private applyCommandPatch(
    guardrail: GuardrailRule,
    command: UpdateGuardrailRuleCommand,
  ): Result<void, ValidationErrors> {
    if (command.metricId !== undefined) {
      guardrail.updateMetricId(command.metricId);
    }

    if (command.threshold !== undefined) {
      const thresholdUpdate = guardrail.updateThreshold(command.threshold);
      if (thresholdUpdate.isErr()) {
        return err(thresholdUpdate.error);
      }
    }

    if (command.operator !== undefined) {
      guardrail.updateOperator(command.operator);
    }

    if (command.windowMinutes !== undefined) {
      const windowUpdate = guardrail.updateWindowMinutes(command.windowMinutes);
      if (windowUpdate.isErr()) {
        return err(windowUpdate.error);
      }
    }

    if (command.action !== undefined) {
      guardrail.updateAction(command.action);
    }

    return ok(undefined);
  }
}
