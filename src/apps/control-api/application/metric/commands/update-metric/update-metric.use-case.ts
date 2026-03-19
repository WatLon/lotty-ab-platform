import { Injectable } from '@nestjs/common';
import {
  MetricId,
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
} from '@/shared/domain/common';
import { UpdateMetricCommand } from './update-metric.command';

@Injectable()
export class UpdateMetricUseCase {
  constructor(
    private readonly metricRepository: MetricRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateMetricCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | ValidationErrors
      | MetricKeyAlreadyExistsError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isAdmin()) return err(new ForbiddenError('metric', actorId));

      const metricId = MetricId.from(command.metricId);
      const metric = await this.metricRepository.findById(metricId);

      if (!metric) return err(new NotFoundError('metric', metricId));

      if (command.name !== undefined) {
        const name = MetricName.create(command.name);

        if (name.isErr()) return err(new ValidationErrors([name.error]));

        metric.changeName(name.value);
      }

      if (command.description !== undefined) metric.changeDescription(command.description);

      const saveResult = await this.metricRepository.save(metric);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
