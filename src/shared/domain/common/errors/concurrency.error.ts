import { Identity } from '../base';
import { DomainError } from './domain-error.base';

export interface ConcurrencyMetadata {
  entity: string;
  entityId: string;
}

export class ConcurrencyError extends DomainError {
  readonly code = 'CONCURRENCY_CONFLICT';

  public readonly metadata: ConcurrencyMetadata;

  constructor(entity: string, entityId: Identity) {
    super(`${entity} was modified by another process, please refresh and try again`);
    this.metadata = { entity, entityId: entityId.toString() };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
