import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ApproverGroupOutput } from './approver-group.output';

export abstract class ApproverGroupReadRepository {
  abstract findById(id: string): Promise<ApproverGroupOutput | null>;

  abstract findByOwnerId(ownerId: string): Promise<ApproverGroupOutput | null>;

  abstract findAll(params: PaginationParams): Promise<PaginatedResult<ApproverGroupOutput>>;
}
