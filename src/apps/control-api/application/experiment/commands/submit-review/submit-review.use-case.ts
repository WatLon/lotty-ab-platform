import { Injectable } from '@nestjs/common';
import { ApproverGroupRepository } from '@/apps/control-api/domain/approver-group';
import {
  AlreadyReviewedError,
  ExperimentAlreadyExistsForFlagError,
  ExperimentId,
  ExperimentRepository,
  ExperimentReviewService,
  InvalidStatusTransitionError,
  NotAuthorizedToReviewError,
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
import { SubmitReviewCommand } from '../submit-review/submit-review.command';

@Injectable()
export class SubmitReviewUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly userRepository: UserRepository,
    private readonly approverGroupRepository: ApproverGroupRepository,
    private readonly reviewService: ExperimentReviewService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: SubmitReviewCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | InvalidStatusTransitionError
      | AlreadyReviewedError
      | NotAuthorizedToReviewError
      | ExperimentAlreadyExistsForFlagError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const experimentId = ExperimentId.from(command.experimentId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isApprover()) return err(new ForbiddenError('experiment', experimentId));

      const experiment = await this.experimentRepository.findById(experimentId);

      if (!experiment) return err(new NotFoundError('experiment', experimentId));

      const approverGroup = await this.approverGroupRepository.findByOwnerId(experiment.ownerId);
      const result = this.reviewService.submitReview(
        experiment,
        { reviewerId: actorId, isAdmin: actor.isAdmin() },
        { decision: command.decision, comment: command.comment },
        approverGroup,
      );

      if (result.isErr()) return err(result.error);

      const saveResult = await this.experimentRepository.save(experiment);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
