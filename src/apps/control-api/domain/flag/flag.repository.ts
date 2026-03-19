import { ConcurrencyError, Result } from '@/shared/domain/common';
import { FlagKeyAlreadyExistsError } from './errors';
import { Flag } from './flag.aggregate-root';
import { FlagId } from './flag.id';
import { FlagKey } from './value-objects/flag-key.vo';

export abstract class FlagRepository {
  abstract findById(id: FlagId): Promise<Flag | null>;

  abstract findByKey(key: FlagKey): Promise<Flag | null>;

  abstract findByKeys(keys: FlagKey[]): Promise<Flag[]>;

  abstract save(entity: Flag): Promise<Result<void, ConcurrencyError | FlagKeyAlreadyExistsError>>;
}
