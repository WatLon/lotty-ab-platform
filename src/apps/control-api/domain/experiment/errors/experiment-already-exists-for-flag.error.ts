import { FlagId } from '@/apps/control-api/domain/flag';
import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export interface ExperimentAlreadyExistsForFlagMetadata {
  flagId: string;
}

export class ExperimentAlreadyExistsForFlagError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.EXPERIMENT_ALREADY_EXISTS_FOR_FLAG;

  public readonly metadata: ExperimentAlreadyExistsForFlagMetadata;

  constructor(flagId: FlagId) {
    super(`An active experiment already exists for flag "${flagId.value}"`);
    this.metadata = { flagId: flagId.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
