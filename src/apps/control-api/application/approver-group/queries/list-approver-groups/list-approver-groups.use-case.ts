import { Injectable } from '@nestjs/common';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { ApproverGroupOutput } from '../../approver-group.output';
import { ApproverGroupReadRepository } from '../../approver-group.read-repository';

@Injectable()
export class ListApproverGroupsUseCase {
  constructor(private readonly approverGroupReadRepository: ApproverGroupReadRepository) {}

  async execute(
    params?: PaginationParams,
  ): Promise<Result<PaginatedResult<ApproverGroupOutput>, never>> {
    const groups = await this.approverGroupReadRepository.findAll(params ?? {});
    return ok(groups);
  }
}
