import { DomainError } from './domain-error.base';
import type { ValidationErrorCode } from './validation/codes';

export abstract class ValidationError extends DomainError {
  abstract readonly code: ValidationErrorCode;

  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
  }

  toPlain() {
    return {
      ...super.toPlain(),
      field: this.field,
    };
  }
}
