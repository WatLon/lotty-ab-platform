import { ValidationError } from '../validation.error';
import { ValidationErrorCode } from './codes';

export interface TooShortMetadata {
  minLength: number;
  actualLength: number;
}

export class TooShortError extends ValidationError {
  readonly code = ValidationErrorCode.TOO_SHORT;

  public readonly metadata: TooShortMetadata;

  constructor(field: string, minLength: number, actualLength: number) {
    super(`${field} must be at least ${minLength} characters`, field);
    this.metadata = { minLength, actualLength };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
