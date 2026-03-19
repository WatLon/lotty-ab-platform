import { BusinessRuleError } from '@/shared/domain/common';
import { FlagKey } from '../value-objects/flag-key.vo';
import { FlagErrorCode } from './codes';

export interface FlagKeyAlreadyExistsMetadata {
  key: string;
}

export class FlagKeyAlreadyExistsError extends BusinessRuleError {
  readonly code = FlagErrorCode.FLAG_KEY_ALREADY_EXISTS;

  public readonly metadata: FlagKeyAlreadyExistsMetadata;

  constructor(key: FlagKey) {
    super(`Flag with key "${key.value}" already exists`);
    this.metadata = { key: key.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
