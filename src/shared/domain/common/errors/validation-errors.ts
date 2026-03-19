import { DomainError } from './domain-error.base';
import type { ValidationError } from './validation.error';

export class ValidationErrors extends DomainError {
  readonly code = 'VALIDATION_FAILED';

  constructor(public readonly errors: ValidationError[]) {
    super('Validation failed');
  }

  toPlain() {
    return {
      code: this.code,
      message: this.message,
      errors: this.errors.map((e) => e.toPlain()),
    };
  }
}
