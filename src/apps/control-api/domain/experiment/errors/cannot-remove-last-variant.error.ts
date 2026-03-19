import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class CannotRemoveLastVariantError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.CANNOT_REMOVE_LAST_VARIANT;

  constructor() {
    super('Cannot remove the last variant');
  }
}
