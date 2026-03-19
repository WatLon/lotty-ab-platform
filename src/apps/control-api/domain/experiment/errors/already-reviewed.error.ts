import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export interface AlreadyReviewedMetadata {
  experimentId: string;
  reviewerId: string;
}

export class AlreadyReviewedError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.ALREADY_REVIEWED;

  public readonly metadata: AlreadyReviewedMetadata;

  constructor(experimentId: string, reviewerId: string) {
    super(`User "${reviewerId}" has already reviewed experiment "${experimentId}"`);
    this.metadata = { experimentId, reviewerId };
  }

  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
