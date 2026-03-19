import { BusinessRuleError } from '@/shared/domain/common';
import { UserErrorCode } from './codes';

export class CannotDeleteSelfError extends BusinessRuleError {
  readonly code = UserErrorCode.USER_CANNOT_DELETE_SELF;

  constructor() {
    super('Cannot delete your own account');
  }
}
