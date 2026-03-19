import { ValidationError } from '../validation.error';
import { ValidationErrorCode } from './codes';

export interface TooHighMetadata {
  max: number;
  actual: number;
}

export class TooHighError extends ValidationError {
  readonly code = ValidationErrorCode.TOO_HIGH;

  public readonly metadata: TooHighMetadata;

  constructor(field: string, max: number, actual: number) {
    super(`${field} must be at most ${max}`, field);
    this.metadata = { max, actual };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
