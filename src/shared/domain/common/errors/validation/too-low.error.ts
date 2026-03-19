import { ValidationError } from '../validation.error';
import { ValidationErrorCode } from './codes';

export interface TooLowMetadata {
  min: number;
  actual: number;
}

export class TooLowError extends ValidationError {
  readonly code = ValidationErrorCode.TOO_LOW;

  public readonly metadata: TooLowMetadata;

  constructor(field: string, min: number, actual: number) {
    super(`${field} must be at least ${min}`, field);
    this.metadata = { min, actual };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
