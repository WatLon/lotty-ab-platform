import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class OutcomeRequiredForCompletionError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.OUTCOME_REQUIRED_FOR_COMPLETION;

  constructor() {
    super('Outcome is required to complete experiment');
  }
}
