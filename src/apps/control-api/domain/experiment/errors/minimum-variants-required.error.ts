import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class MinimumVariantsRequiredError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.MINIMUM_VARIANTS_REQUIRED;

  constructor() {
    super('Experiment must have at least 2 variants');
  }
}
