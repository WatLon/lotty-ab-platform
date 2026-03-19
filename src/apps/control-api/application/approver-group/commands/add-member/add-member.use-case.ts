import { Injectable } from '@nestjs/common';
import {
  ApproverGroupAlreadyExistsError,
  ApproverGroupId,
  ApproverGroupRepository,
  MemberAlreadyInGroupError,
} from '@/apps/control-api/domain/approver-group';
import { UserId, UserRepository } from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Result,
} from '@/shared/domain/common';
import { AddMemberToGroupCommand } from './add-member.command';

@Injectable()
export class AddMemberToGroupUseCase {
  constructor(
    private readonly approverGroupRepository: ApproverGroupRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: AddMemberToGroupCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | MemberAlreadyInGroupError
      | ApproverGroupAlreadyExistsError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const groupId = ApproverGroupId.from(command.groupId);
      const userId = UserId.from(command.userId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) {
        return err(new NotFoundError('user', actorId));
      }

      if (!actor.isAdmin()) {
        return err(new ForbiddenError('approverGroup', groupId));
      }

      const group = await this.approverGroupRepository.findById(groupId);

      if (!group) {
        return err(new NotFoundError('approverGroup', groupId));
      }

      if (!(await this.userRepository.findById(userId))) {
        return err(new NotFoundError('user', userId));
      }

      const addResult = group.addMember(userId);

      if (addResult.isErr()) {
        return err(addResult.error);
      }

      const saveResult = await this.approverGroupRepository.save(group);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }
}
