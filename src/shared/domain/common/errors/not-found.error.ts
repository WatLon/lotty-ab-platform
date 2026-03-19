import { Identity } from '../base';
import { DomainError } from './domain-error.base';

export interface NotFoundMetadata {
  entity: string;
  id: string;
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  public readonly metadata: NotFoundMetadata;

  constructor(entity: string, id: Identity) {
    super(`${entity} with id ${id.toString()} not found`);
    this.metadata = { entity, id: id.toString() };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
