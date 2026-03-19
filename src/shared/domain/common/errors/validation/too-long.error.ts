import { ValidationError } from '../validation.error';
import { ValidationErrorCode } from './codes';

export interface TooLongMetadata {
  maxLength: number;
  actualLength: number;
}

export class TooLongError extends ValidationError {
  readonly code = ValidationErrorCode.TOO_LONG;

  public readonly metadata: TooLongMetadata;

  constructor(field: string, maxLength: number, actualLength: number) {
    super(`${field} must be less than ${maxLength} characters`, field);
    this.metadata = { maxLength, actualLength };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
