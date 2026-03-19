import {
  BusinessRuleError,
  ConcurrencyError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ValidationErrors,
} from '@/shared/domain/common/errors';

export function domainErrorToHttpStatus(error: DomainError): number {
  if (error instanceof ValidationErrors) return 400;
  if (error instanceof ValidationError) return 400;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof ConcurrencyError) return 409;
  if (error instanceof BusinessRuleError) return 409;

  return 500;
}
