import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export class CompletionCommentRequiredError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.COMPLETION_COMMENT_REQUIRED;

  constructor() {
    super('Completion comment is required');
  }
}
