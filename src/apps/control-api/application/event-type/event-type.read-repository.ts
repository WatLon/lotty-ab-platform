import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { EventTypeOutput } from './event-type.output';

export abstract class EventTypeReadRepository {
  abstract findById(id: string): Promise<EventTypeOutput | null>;

  abstract findAll(params: PaginationParams): Promise<PaginatedResult<EventTypeOutput>>;
}
