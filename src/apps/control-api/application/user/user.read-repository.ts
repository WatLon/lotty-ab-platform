import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { UserOutput } from './user.output';

export abstract class UserReadRepository {
  abstract findById(id: string): Promise<UserOutput | null>;

  abstract findByEmail(email: string): Promise<UserOutput | null>;

  abstract findAll(params: PaginationParams): Promise<PaginatedResult<UserOutput>>;
}
