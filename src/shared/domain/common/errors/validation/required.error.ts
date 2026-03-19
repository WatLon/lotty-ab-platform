import { ValidationError } from '../validation.error';
import { ValidationErrorCode } from './codes';

export class RequiredError extends ValidationError {
  readonly code = ValidationErrorCode.REQUIRED;

  constructor(field: string) {
    super(`${field} is required`, field);
  }
}
