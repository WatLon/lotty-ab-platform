import { Injectable } from '@nestjs/common';
import {
  AudiencePercent,
  Experiment,
  ExperimentAlreadyExistsForFlagError,
  ExperimentName,
  ExperimentRepository,
  ExperimentStatus,
  MinimumVariantsRequiredError,
  MultipleControlVariantsError,
  NoControlVariantError,
  TargetingRule,
  Variant,
  VariantName,
  VariantsWeightMismatchError,
  VariantValue,
  VariantWeight,
} from '@/apps/control-api/domain/experiment';
import { FlagId, FlagRepository, FlagValueType } from '@/apps/control-api/domain/flag';
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
  ValidationError,
  ValidationErrors,
} from '@/shared/domain/common';
import { InvalidFormatError } from '@/shared/domain/common/errors';
import { CreateExperimentCommand } from './create-experiment.command';

interface ParsedInputs {
  name: ExperimentName;
  audiencePercent: AudiencePercent;
  targetingRule: TargetingRule;
  variants: Variant[];
}

@Injectable()
export class CreateExperimentUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flagRepository: FlagRepository,
    private readonly metricRepository: MetricRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: CreateExperimentCommand,
  ): Promise<
    Result<
      { id: string },
      | ExperimentAlreadyExistsForFlagError
      | NotFoundError
      | ForbiddenError
      | MetricArchivedError
      | ConcurrencyError
      | MinimumVariantsRequiredError
      | NoControlVariantError
      | MultipleControlVariantsError
      | VariantsWeightMismatchError
      | ValidationErrors
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const flagId = FlagId.from(command.flagId);

      const actor = await this.userRepository.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isExperimenter()) return err(new ForbiddenError('experiment', flagId));

      const flag = await this.flagRepository.findById(flagId);
      if (!flag) return err(new NotFoundError('flag', flagId));

      const activeExperiments = await this.experimentRepository.findByFlagIdAndStatuses(flagId, [
        ExperimentStatus.RUNNING,
        ExperimentStatus.PAUSED,
      ]);
      if (activeExperiments.length > 0) {
        return err(new ExperimentAlreadyExistsForFlagError(flagId));
      }

      const parseResult = this.parseInputs(command, flag.valueType);
      if (parseResult.isErr()) return err(parseResult.error);

      const verifyResult = await this.verifyMetrics(command.metricIds);
      if (verifyResult.isErr()) return err(verifyResult.error);

      const { name, audiencePercent, targetingRule, variants } = parseResult.value;

      const experimentResult = Experiment.create({
        name,
        description: command.description,
        flagId,
        conflictDomain: command.conflictDomain,
        priority: command.priority ?? 0,
        audiencePercent,
        targetingRule,
        ownerId: actorId,
        variants,
        metricIds: command.metricIds,
        primaryMetricId: command.primaryMetricId,
      });
      if (experimentResult.isErr()) return err(experimentResult.error);

      const saveResult = await this.experimentRepository.save(experimentResult.value);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok({ id: experimentResult.value.id.value });
    });
  }

  private parseInputs(
    command: CreateExperimentCommand,
    flagValueType: FlagValueType,
  ): Result<ParsedInputs, ValidationErrors> {
    const fieldsResult = Result.combineAll({
      name: ExperimentName.create(command.name),
      audiencePercent: AudiencePercent.create(command.audiencePercent),
      targetingRule: TargetingRule.create(command.targetingRule),
    });

    const variantsResult = this.parseVariants(command.variants, flagValueType);

    if (fieldsResult.isOk() && variantsResult.isOk()) {
      return ok({ ...fieldsResult.value, variants: variantsResult.value });
    }

    const errors: ValidationError[] = [];
    if (fieldsResult.isErr()) errors.push(...fieldsResult.error);
    if (variantsResult.isErr()) errors.push(...variantsResult.error);

    return err(new ValidationErrors(errors));
  }

  private parseVariants(
    inputs: CreateExperimentCommand['variants'],
    flagValueType: FlagValueType,
  ): Result<Variant[], ValidationError[]> {
    const variants: Variant[] = [];
    const errors: ValidationError[] = [];

    for (const [index, input] of inputs.entries()) {
      const typeError = this.validateVariantValueType(input.value, flagValueType, index);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      const voResult = Result.combineAll({
        name: VariantName.create(input.name),
        value: VariantValue.create(input.value),
        weight: VariantWeight.create(input.weight),
      });

      if (voResult.isErr()) {
        errors.push(...voResult.error);
        continue;
      }

      const variantResult = Variant.create({ ...voResult.value, isControl: input.isControl });
      if (variantResult.isOk()) variants.push(variantResult.value);
    }

    return errors.length > 0 ? err(errors) : ok(variants);
  }

  private validateVariantValueType(
    value: string,
    flagValueType: FlagValueType,
    index: number,
  ): InvalidFormatError | null {
    switch (flagValueType) {
      case FlagValueType.NUMBER:
        return Number.isNaN(Number(value))
          ? new InvalidFormatError(`variants[${index}].value`, 'valid number')
          : null;
      case FlagValueType.BOOLEAN:
        return value !== 'true' && value !== 'false'
          ? new InvalidFormatError(`variants[${index}].value`, '"true" or "false"')
          : null;
      case FlagValueType.STRING:
        return null;
    }
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
}
