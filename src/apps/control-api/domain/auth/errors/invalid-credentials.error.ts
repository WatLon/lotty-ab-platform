import { UnauthorizedError } from '@/shared/domain/common';
import { AuthErrorCode } from './codes';

export class InvalidCredentialsError extends UnauthorizedError {
  readonly code = AuthErrorCode.INVALID_CREDENTIALS;

  constructor() {
    super('Invalid email or password');
  }
}
