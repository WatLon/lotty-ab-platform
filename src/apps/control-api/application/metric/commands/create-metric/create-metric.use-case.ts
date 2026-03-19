import { Injectable } from '@nestjs/common';
import {
  Metric,
  MetricFormula,
  MetricKey,
  MetricKeyAlreadyExistsError,
  MetricName,
  MetricRepository,
} from '@/apps/control-api/domain/metric';
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
  validate,
} from '@/shared/domain/common';
import { CreateMetricCommand } from './create-metric.command';

@Injectable()
export class CreateMetricUseCase {
  constructor(
    private readonly metricRepository: MetricRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: CreateMetricCommand,
  ): Promise<
    Result<
      { id: string },
      | ValidationErrors
      | NotFoundError
      | ForbiddenError
      | MetricKeyAlreadyExistsError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isAdmin()) return err(new ForbiddenError('metric', actorId));

      const validation = validate({
        key: MetricKey.create(command.key),
        name: MetricName.create(command.name),
        formula: MetricFormula.create(command.formula),
      });

      if (validation.isErr()) return err(validation.error);

      const { key, name, formula } = validation.value;
      const existing = await this.metricRepository.findByKey(key);

      if (existing) return err(new MetricKeyAlreadyExistsError(key));

      const metric = Result.unwrapOk(
        Metric.create({
          key,
          name,
          description: command.description,
          formula,
        }),
      );

      const saveResult = await this.metricRepository.save(metric);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok({ id: metric.id.value });
    });
  }
}
