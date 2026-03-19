import { Injectable } from '@nestjs/common';
import {
  ExperimentAlreadyExistsForFlagError,
  ExperimentId,
  ExperimentRepository,
  ExperimentStatus,
  InvalidStatusTransitionError,
} from '@/apps/control-api/domain/experiment';
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
import { StartExperimentCommand } from './start-experiment.command';

@Injectable()
export class StartExperimentUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: StartExperimentCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | InvalidStatusTransitionError
      | ExperimentAlreadyExistsForFlagError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const experimentId = ExperimentId.from(command.experimentId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) {
        return err(new NotFoundError('user', actorId));
      }

      const experiment = await this.experimentRepository.findById(experimentId);

      if (!experiment) {
        return err(new NotFoundError('experiment', experimentId));
      }

      if (!experiment.ownerId.equals(actorId) && !actor.isAdmin()) {
        return err(new ForbiddenError('experiment', experimentId));
      }

      const runningExperiments = await this.experimentRepository.findByFlagIdAndStatuses(
        experiment.flagId,
        [ExperimentStatus.RUNNING],
      );
      if (
        runningExperiments.some((runningExperiment) => !runningExperiment.id.equals(experimentId))
      ) {
        return err(new ExperimentAlreadyExistsForFlagError(experiment.flagId));
      }

      const actionResult = experiment.start();

      if (actionResult.isErr()) {
        return err(actionResult.error);
      }

      const saveResult = await this.experimentRepository.save(experiment);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }
}
