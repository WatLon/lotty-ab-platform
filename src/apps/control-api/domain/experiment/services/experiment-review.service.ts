import { ApproverGroup } from '@/apps/control-api/domain/approver-group';
import {
  AlreadyReviewedError,
  InvalidStatusTransitionError,
  NotAuthorizedToReviewError,
} from '@/apps/control-api/domain/experiment/errors';
import { UserId } from '@/apps/control-api/domain/user';
import { err, ok, Result } from '@/shared/domain/common';
import { ReviewDecision } from '../enums/review-decision.enum';
import { Experiment } from '../experiment.aggregate-root';

export interface ReviewPolicy {
  requiredApprovals: number;
  requiredRejections: number;
}

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
  requiredApprovals: 1,
  requiredRejections: 1,
};

export interface ReviewerContext {
  reviewerId: UserId;
  isAdmin: boolean;
}

export interface ReviewInput {
  decision: ReviewDecision;
  comment: string | null;
}

export class ExperimentReviewService {
  submitReview(
    experiment: Experiment,
    reviewer: ReviewerContext,
    input: ReviewInput,
    approverGroup: ApproverGroup | null,
  ): Result<
    void,
    InvalidStatusTransitionError | AlreadyReviewedError | NotAuthorizedToReviewError
  > {
    const alreadyReviewed = experiment.reviews.some(
      (r) => r.reviewerId === reviewer.reviewerId.value,
    );

    if (alreadyReviewed) {
      return err(new AlreadyReviewedError(experiment.id.value, reviewer.reviewerId.value));
    }

    if (approverGroup) {
      if (!approverGroup.hasMember(reviewer.reviewerId)) {
        return err(new NotAuthorizedToReviewError(experiment.id.value, reviewer.reviewerId.value));
      }
    } else if (!reviewer.isAdmin) {
      return err(new NotAuthorizedToReviewError(experiment.id.value, reviewer.reviewerId.value));
    }

    const policy = this.resolvePolicy(approverGroup);
    const addResult = experiment.addReview({
      reviewerId: reviewer.reviewerId,
      decision: input.decision,
      comment: input.comment,
    });

    if (addResult.isErr()) return err(addResult.error);

    return this.applyDecision(experiment, input.decision, policy);
  }

  private resolvePolicy(approverGroup: ApproverGroup | null): ReviewPolicy {
    if (!approverGroup) return DEFAULT_REVIEW_POLICY;

    return {
      requiredApprovals: approverGroup.requiredApprovals.value,
      requiredRejections: DEFAULT_REVIEW_POLICY.requiredRejections,
    };
  }

  private applyDecision(
    experiment: Experiment,
    decision: ReviewDecision,
    policy: ReviewPolicy,
  ): Result<void, InvalidStatusTransitionError> {
    switch (decision) {
      case ReviewDecision.APPROVED:
        if (experiment.approvalCount >= policy.requiredApprovals) {
          return experiment.approve();
        }
        break;

      case ReviewDecision.REJECTED:
        if (experiment.rejectionCount >= policy.requiredRejections) {
          return experiment.reject();
        }
        break;

      case ReviewDecision.CHANGES_REQUESTED:
        return experiment.requestChanges();
    }

    return ok(undefined);
  }
}
