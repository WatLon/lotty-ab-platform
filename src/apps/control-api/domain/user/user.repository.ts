import { ConcurrencyError, Result } from '@/shared/domain/common';
import { EmailAlreadyExistsError } from './errors';
import { User } from './user.aggregate-root';
import { UserId } from './user.id';
import { UserEmail } from './value-objects';

export abstract class UserRepository {
  abstract findById(id: UserId): Promise<User | null>;

  abstract findByEmail(email: UserEmail): Promise<User | null>;

  abstract save(entity: User): Promise<Result<void, ConcurrencyError | EmailAlreadyExistsError>>;

  abstract delete(id: UserId): Promise<void>;
}
