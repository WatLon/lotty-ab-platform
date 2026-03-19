import { ValidationError } from '../validation.error';
import { ValidationErrorCode } from './codes';

export interface InvalidFormatMetadata {
  expected: string;
}

export class InvalidFormatError extends ValidationError {
  readonly code = ValidationErrorCode.INVALID_FORMAT;

  public readonly metadata: InvalidFormatMetadata;

  constructor(field: string, expected: string) {
    super(`Invalid ${field} format`, field);
    this.metadata = { expected };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
