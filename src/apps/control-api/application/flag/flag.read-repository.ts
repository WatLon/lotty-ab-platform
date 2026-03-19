import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { FlagOutput } from './flag.output';

export abstract class FlagReadRepository {
  abstract findById(id: string): Promise<FlagOutput | null>;

  abstract findAll(params: PaginationParams): Promise<PaginatedResult<FlagOutput>>;
}
