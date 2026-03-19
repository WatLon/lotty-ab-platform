import { DomainError } from './domain-error.base';

export abstract class BusinessRuleError extends DomainError {
  abstract readonly code: string;
}
