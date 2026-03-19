import { Injectable } from '@nestjs/common';
import { ApproverGroupId } from '@/apps/control-api/domain/approver-group';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { ApproverGroupOutput } from '../../approver-group.output';
import { ApproverGroupReadRepository } from '../../approver-group.read-repository';
import { GetApproverGroupQuery } from './get-approver-group.query';

@Injectable()
export class GetApproverGroupUseCase {
  constructor(private readonly approverGroupReadRepository: ApproverGroupReadRepository) {}

  async execute(query: GetApproverGroupQuery): Promise<Result<ApproverGroupOutput, NotFoundError>> {
    const group = await this.approverGroupReadRepository.findById(query.groupId);
    if (!group) {
      return err(new NotFoundError('approverGroup', ApproverGroupId.from(query.groupId)));
    }
    return ok(group);
  }
}
