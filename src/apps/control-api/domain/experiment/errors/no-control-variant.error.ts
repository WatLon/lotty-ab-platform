import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class NoControlVariantError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.NO_CONTROL_VARIANT;

  constructor() {
    super('Experiment must have exactly one control variant');
  }
}
