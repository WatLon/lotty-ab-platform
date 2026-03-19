import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export interface NotAuthorizedToReviewMetadata {
  experimentId: string;
  reviewerId: string;
}

export class NotAuthorizedToReviewError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.NOT_AUTHORIZED_TO_REVIEW;

  public readonly metadata: NotAuthorizedToReviewMetadata;

  constructor(experimentId: string, reviewerId: string) {
    super(`User "${reviewerId}" is not authorized to review experiment "${experimentId}"`);
    this.metadata = { experimentId, reviewerId };
  }

  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
