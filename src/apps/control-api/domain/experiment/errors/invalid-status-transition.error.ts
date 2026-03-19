import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentStatus } from '../enums/experiment-status.enum';
import { ExperimentErrorCode } from './codes';

export interface InvalidStatusTransitionMetadata {
  currentStatus: ExperimentStatus;
  targetStatus: ExperimentStatus;
}

export class InvalidStatusTransitionError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.INVALID_STATUS_TRANSITION;

  public readonly metadata: InvalidStatusTransitionMetadata;

  constructor(currentStatus: ExperimentStatus, targetStatus: ExperimentStatus) {
    super(`Cannot transition from "${currentStatus}" to "${targetStatus}"`);
    this.metadata = { currentStatus, targetStatus };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
