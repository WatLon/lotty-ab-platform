import { BusinessRuleError } from '@/shared/domain/common';
import { UserEmail } from '../value-objects';
import { UserErrorCode } from './codes';

export interface EmailAlreadyExistsMetadata {
  email: string;
}

export class EmailAlreadyExistsError extends BusinessRuleError {
  readonly code = UserErrorCode.USER_EMAIL_ALREADY_EXISTS;

  public readonly metadata: EmailAlreadyExistsMetadata;

  constructor(email: UserEmail) {
    super(`User with email "${email.value}" already exists`);
    this.metadata = { email: email.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
