import { Injectable } from '@nestjs/common';
import {
  ApproverGroupAlreadyExistsError,
  ApproverGroupId,
  ApproverGroupRepository,
  RequiredApprovals,
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
  ValidationErrors,
  validate,
} from '@/shared/domain/common';
import { UpdateApproverGroupCommand } from './update-approver-group.command';

@Injectable()
export class UpdateApproverGroupUseCase {
  constructor(
    private readonly approverGroupRepository: ApproverGroupRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateApproverGroupCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | ApproverGroupAlreadyExistsError
      | ConcurrencyError
      | ValidationErrors
    >
  > {
    return this.transactionManager.execute(async () => {
      const validation = validate({
        requiredApprovals: RequiredApprovals.create(command.requiredApprovals),
      });

      if (validation.isErr()) {
        return err(validation.error);
      }

      const { requiredApprovals } = validation.value;
      const actorId = UserId.from(command.actorId);
      const groupId = ApproverGroupId.from(command.groupId);
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

      group.changeRequiredApprovals(requiredApprovals);
      const saveResult = await this.approverGroupRepository.save(group);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }
}
