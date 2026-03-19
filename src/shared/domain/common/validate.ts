import { Result, type Result as ResultType } from './base/result';
import type { ValidationError } from './errors/validation.error';
import { ValidationErrors } from './errors/validation-errors';

type ExtractOk<T> = T extends ResultType<infer U, unknown> ? U : never;

export function validate<T extends Record<string, ResultType<unknown, ValidationError>>>(
  results: T,
): ResultType<
  {
    [K in keyof T]: ExtractOk<T[K]>;
  },
  ValidationErrors
> {
  return Result.combineAll(results).mapErr((errors) => new ValidationErrors(errors));
}
