import { Injectable } from '@nestjs/common';
import { ok, Result } from '@/shared/domain/common';
import { ApproverGroupOutput } from '../../approver-group.output';
import { ApproverGroupReadRepository } from '../../approver-group.read-repository';
import { GetApproverGroupForOwnerQuery } from './get-approver-group-for-owner.query';

@Injectable()
export class GetApproverGroupForOwnerUseCase {
  constructor(private readonly approverGroupReadRepository: ApproverGroupReadRepository) {}

  async execute(
    query: GetApproverGroupForOwnerQuery,
  ): Promise<Result<ApproverGroupOutput | null, never>> {
    const group = await this.approverGroupReadRepository.findByOwnerId(query.ownerId);
    return ok(group);
  }
}
