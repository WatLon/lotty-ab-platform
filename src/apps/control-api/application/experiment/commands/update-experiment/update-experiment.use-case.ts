import { Injectable } from '@nestjs/common';
import {
  AudiencePercent,
  Experiment,
  ExperimentAlreadyExistsForFlagError,
  ExperimentId,
  ExperimentName,
  ExperimentNotEditableError,
  ExperimentRepository,
  TargetingRule,
} from '@/apps/control-api/domain/experiment';
import { MetricArchivedError, MetricId, MetricRepository } from '@/apps/control-api/domain/metric';
import { UserId, UserRepository } from '@/apps/control-api/domain/user';
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
import { UpdateExperimentCommand } from './update-experiment.command';

interface ParsedFields {
  name?: ExperimentName;
  description?: string | null;
  audiencePercent?: AudiencePercent;
  targetingRule?: TargetingRule;
}

@Injectable()
export class UpdateExperimentUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly metricRepository: MetricRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateExperimentCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | ExperimentNotEditableError
      | MetricArchivedError
      | ExperimentAlreadyExistsForFlagError
      | ConcurrencyError
      | ValidationErrors
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const experimentId = ExperimentId.from(command.experimentId);

      const actor = await this.userRepository.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      const experiment = await this.experimentRepository.findById(experimentId);
      if (!experiment) return err(new NotFoundError('experiment', experimentId));

      if (!experiment.ownerId.equals(actorId) && !actor.isAdmin()) {
        return err(new ForbiddenError('experiment', experimentId));
      }

      const parseResult = this.parseInputs(command);
      if (parseResult.isErr()) return err(parseResult.error);

      if (this.hasMetricUpdate(command)) {
        const verifyResult = await this.verifyMetrics(
          command.metricIds ?? [...experiment.metricIds],
        );
        if (verifyResult.isErr()) return err(verifyResult.error);
      }

      const applyResult = this.applyChanges(experiment, parseResult.value, command);
      if (applyResult.isErr()) return err(applyResult.error);

      return this.experimentRepository.save(experiment);
    });
  }

  private parseInputs(command: UpdateExperimentCommand): Result<ParsedFields, ValidationErrors> {
    const result = Result.combineAll({
      name: Result.validateOptional(command.name, ExperimentName.create),
      audiencePercent: Result.validateOptional(command.audiencePercent, AudiencePercent.create),
      targetingRule: Result.validateOptional(command.targetingRule, TargetingRule.create),
    });

    if (result.isErr()) return err(new ValidationErrors(result.error));

    return ok({ ...result.value, description: command.description });
  }

  private applyChanges(
    experiment: Experiment,
    parsed: ParsedFields,
    command: UpdateExperimentCommand,
  ): Result<void, ExperimentNotEditableError | ValidationErrors> {
    if (parsed.name !== undefined) {
      const r = experiment.changeName(parsed.name);
      if (r.isErr()) return err(r.error);
    }

    if (parsed.description !== undefined) {
      const r = experiment.changeDescription(parsed.description);
      if (r.isErr()) return err(r.error);
    }

    if (parsed.audiencePercent !== undefined) {
      const r = experiment.changeAudiencePercent(parsed.audiencePercent);
      if (r.isErr()) return err(r.error);
    }

    if (parsed.targetingRule !== undefined) {
      const r = experiment.changeTargetingRule(parsed.targetingRule);
      if (r.isErr()) return err(r.error);
    }

    if (this.hasMetricUpdate(command)) {
      const metricIds = command.metricIds ?? [...experiment.metricIds];
      const primaryMetricId =
        command.primaryMetricId !== undefined
          ? command.primaryMetricId
          : experiment.primaryMetricId;

      const r = experiment.replaceMetrics(metricIds, primaryMetricId);
      if (r.isErr()) return err(r.error);
    }

    return ok(undefined);
  }

  private async verifyMetrics(
    metricIdRaws: readonly string[],
  ): Promise<Result<void, NotFoundError | MetricArchivedError>> {
    if (metricIdRaws.length === 0) return ok(undefined);

    const metricIds = metricIdRaws.map((id) => MetricId.from(id));
    const metrics = await this.metricRepository.findByIds(metricIds);
    const metricsById = new Map(metrics.map((m) => [m.id.value, m]));

    for (const raw of metricIdRaws) {
      const metricId = MetricId.from(raw);
      const metric = metricsById.get(metricId.value);
      if (!metric) return err(new NotFoundError('metric', metricId));
      if (metric.isArchived) return err(new MetricArchivedError(metricId));
    }

    return ok(undefined);
  }

  private hasMetricUpdate(command: UpdateExperimentCommand): boolean {
    return command.metricIds !== undefined || command.primaryMetricId !== undefined;
  }
}
