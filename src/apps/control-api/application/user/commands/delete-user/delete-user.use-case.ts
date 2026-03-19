import { Injectable } from '@nestjs/common';
import { CannotDeleteSelfError, UserId, UserRepository } from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import { err, ForbiddenError, NotFoundError, ok, Result } from '@/shared/domain/common';
import { DeleteUserCommand } from './delete-user.command';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: DeleteUserCommand,
  ): Promise<Result<void, NotFoundError | ForbiddenError | CannotDeleteSelfError>> {
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
        return err(new CannotDeleteSelfError());
      }

      const targetUser = await this.userRepository.findById(targetUserId);

      if (!targetUser) {
        return err(new NotFoundError('user', targetUserId));
      }

      await this.userRepository.delete(targetUserId);

      return ok(undefined);
    });
  }
}
