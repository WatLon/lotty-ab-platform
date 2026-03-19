import { Identity } from '../base';
import { DomainError } from './domain-error.base';

export interface ForbiddenMetadata {
  resource: string;
  resourceId: string;
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';

  public readonly metadata: ForbiddenMetadata;

  constructor(resource: string, resourceId: Identity | string) {
    super(`Access to ${resource} is forbidden`);
    this.metadata = {
      resource,
      resourceId: typeof resourceId === 'string' ? resourceId : resourceId.toString(),
    };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
