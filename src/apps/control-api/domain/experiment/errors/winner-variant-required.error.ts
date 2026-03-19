import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class WinnerVariantRequiredError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.WINNER_VARIANT_REQUIRED;

  constructor() {
    super('Winner variant is required for ROLLOUT_WINNER outcome');
  }
}
