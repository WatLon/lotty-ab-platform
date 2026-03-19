import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class MultipleControlVariantsError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.MULTIPLE_CONTROL_VARIANTS;

  constructor() {
    super('Experiment cannot have more than one control variant');
  }
}
