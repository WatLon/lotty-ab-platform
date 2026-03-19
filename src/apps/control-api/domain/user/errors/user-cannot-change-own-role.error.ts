import { BusinessRuleError } from '@/shared/domain/common';
import { UserErrorCode } from './codes';

export class CannotChangeOwnRoleError extends BusinessRuleError {
  readonly code = UserErrorCode.USER_CANNOT_CHANGE_OWN_ROLE;

  constructor() {
    super('Cannot change your own role');
  }
}
