import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentStatus } from '../enums/experiment-status.enum';
import { ExperimentErrorCode } from './codes';

export interface ExperimentNotEditableMetadata {
  status: ExperimentStatus;
}

export class ExperimentNotEditableError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.EXPERIMENT_NOT_EDITABLE;

  public readonly metadata: ExperimentNotEditableMetadata;

  constructor(status: ExperimentStatus) {
    super(`Experiment cannot be edited in status "${status}"`);
    this.metadata = { status };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
