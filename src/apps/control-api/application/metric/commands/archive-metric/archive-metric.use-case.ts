import { Injectable } from '@nestjs/common';
import {
  MetricId,
  MetricInUseByActiveGuardrailsError,
  MetricKeyAlreadyExistsError,
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
} from '@/shared/domain/common';
import { ArchiveMetricCommand } from './archive-metric.command';

@Injectable()
export class ArchiveMetricUseCase {
  constructor(
    private readonly metricRepository: MetricRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: ArchiveMetricCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | MetricInUseByActiveGuardrailsError
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

      if (metric.isArchived) return ok(undefined);

      const isUsed = await this.metricRepository.isUsedByActiveGuardrails(metricId);

      if (isUsed) return err(new MetricInUseByActiveGuardrailsError(metricId));

      metric.archive();
      const saveResult = await this.metricRepository.save(metric);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
