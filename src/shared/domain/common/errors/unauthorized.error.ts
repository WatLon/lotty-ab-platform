import { DomainError } from './domain-error.base';

export class UnauthorizedError extends DomainError {
  readonly code: string = 'UNAUTHORIZED';

  constructor(message = 'Unauthorized') {
    super(message);
  }
}
