import { Injectable } from '@nestjs/common';
import {
  ApproverGroup,
  ApproverGroupAlreadyExistsError,
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
import { CreateApproverGroupCommand } from './create-approver-group.command';

@Injectable()
export class CreateApproverGroupUseCase {
  constructor(
    private readonly approverGroupRepository: ApproverGroupRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateApproverGroupCommand): Promise<
    Result<
      {
        id: string;
      },
      | ApproverGroupAlreadyExistsError
      | NotFoundError
      | ForbiddenError
      | ConcurrencyError
      | ValidationErrors
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const ownerId = UserId.from(command.ownerId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) {
        return err(new NotFoundError('user', actorId));
      }

      if (!actor.isAdmin()) {
        return err(new ForbiddenError('approverGroup', ownerId));
      }

      const owner = await this.userRepository.findById(ownerId);

      if (!owner) {
        return err(new NotFoundError('user', ownerId));
      }

      const validation = validate({
        requiredApprovals: RequiredApprovals.create(command.requiredApprovals),
      });

      if (validation.isErr()) {
        return err(validation.error);
      }

      const { requiredApprovals } = validation.value;
      const existing = await this.approverGroupRepository.findByOwnerId(ownerId);

      if (existing) {
        return err(new ApproverGroupAlreadyExistsError(ownerId));
      }

      const groupResult = ApproverGroup.create({ ownerId, requiredApprovals });

      if (groupResult.isErr()) {
        return err(groupResult.error);
      }

      const group = groupResult.value;
      const saveResult = await this.approverGroupRepository.save(group);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok({ id: group.id.value });
    });
  }
}
