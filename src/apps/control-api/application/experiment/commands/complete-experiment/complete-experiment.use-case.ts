import { Injectable } from '@nestjs/common';
import {
  CompletionCommentRequiredError,
  ExperimentAlreadyExistsForFlagError,
  ExperimentId,
  ExperimentRepository,
  InvalidStatusTransitionError,
  OutcomeRequiredForCompletionError,
  VariantId,
  VariantNotFoundError,
  WinnerVariantRequiredError,
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
import { CompleteExperimentCommand } from './complete-experiment.command';

@Injectable()
export class CompleteExperimentUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: CompleteExperimentCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | InvalidStatusTransitionError
      | VariantNotFoundError
      | OutcomeRequiredForCompletionError
      | CompletionCommentRequiredError
      | WinnerVariantRequiredError
      | ExperimentAlreadyExistsForFlagError
      | ConcurrencyError
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

      const actionResult = experiment.complete({
        type: command.outcomeType,
        winnerVariantId: command.winnerVariantId ? VariantId.from(command.winnerVariantId) : null,
        comment: command.comment,
        decidedById: actorId,
      });
      if (actionResult.isErr()) return err(actionResult.error);

      const saveResult = await this.experimentRepository.save(experiment);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
