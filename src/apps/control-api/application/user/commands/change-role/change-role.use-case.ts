import { Injectable } from '@nestjs/common';
import {
  CannotChangeOwnRoleError,
  EmailAlreadyExistsError,
  UserId,
  UserRepository,
} from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Result,
} from '@/shared/domain/common';
import { ChangeRoleCommand } from './change-role.command';

@Injectable()
export class ChangeRoleUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: ChangeRoleCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | CannotChangeOwnRoleError
      | EmailAlreadyExistsError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const targetUserId = UserId.from(command.targetUserId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) {
        return err(new NotFoundError('user', actorId));
      }

      if (!actor.isAdmin()) {
        return err(new ForbiddenError('user', targetUserId));
      }

      if (actorId.equals(targetUserId)) {
        return err(new CannotChangeOwnRoleError());
      }

      const targetUser = await this.userRepository.findById(targetUserId);

      if (!targetUser) {
        return err(new NotFoundError('user', targetUserId));
      }

      targetUser.changeRole(command.role);
      const saveResult = await this.userRepository.save(targetUser);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }
}
