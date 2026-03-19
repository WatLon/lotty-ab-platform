import { Injectable } from '@nestjs/common';
import {
  GuardrailRule,
  GuardrailRuleAlreadyExistsError,
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
import { CreateGuardrailRuleCommand } from './create-guardrail-rule.command';

type CreateGuardrailRuleError =
  | NotFoundError
  | ForbiddenError
  | MetricArchivedError
  | GuardrailRuleAlreadyExistsError
  | ValidationErrors
  | ConcurrencyError;

@Injectable()
export class CreateGuardrailRuleUseCase {
  constructor(
    private readonly guardrailAccessService: GuardrailAccessService,
    private readonly metricRepository: MetricRepository,
    private readonly guardrailRuleRepository: GuardrailRuleRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateGuardrailRuleCommand): Promise<
    Result<
      {
        id: string;
      },
      CreateGuardrailRuleError
    >
  > {
    return this.transactionManager.execute(async () => {
      const accessResult = await this.guardrailAccessService.requireExperimentAccess(
        command.actorId,
        command.experimentId,
      );

      if (accessResult.isErr()) {
        return err(accessResult.error);
      }

      const accessContext = accessResult.value;
      const metricValidationResult = await this.validateMetricAccess(
        command.metricId,
        accessContext,
      );

      if (metricValidationResult.isErr()) {
        return err(metricValidationResult.error);
      }

      const guardrailResult = GuardrailRule.create({
        experimentId: command.experimentId,
        metricId: command.metricId,
        threshold: command.threshold,
        operator: command.operator,
        windowMinutes: command.windowMinutes,
        action: command.action,
      });

      if (guardrailResult.isErr()) {
        return err(guardrailResult.error);
      }

      const guardrail = guardrailResult.value;
      const saveResult = await this.guardrailRuleRepository.save(guardrail);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok({ id: guardrail.id.value });
    });
  }

  private async validateMetricAccess(
    metricIdRaw: string,
    accessContext: GuardrailAccessContext,
  ): Promise<Result<void, NotFoundError | MetricArchivedError>> {
    const metricId = MetricId.from(metricIdRaw);
    const metric = await this.metricRepository.findById(metricId);

    if (!metric) {
      return err(new NotFoundError('metric', metricId));
    }

    if (metric.isArchived) {
      return err(new MetricArchivedError(metricId));
    }

    if (!accessContext.experiment.metricIds.includes(metricIdRaw)) {
      return err(new NotFoundError('metric', metricId));
    }

    return ok(undefined);
  }
}
