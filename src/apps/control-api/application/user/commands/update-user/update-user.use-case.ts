import { Injectable } from '@nestjs/common';
import {
  EmailAlreadyExistsError,
  UserId,
  UserName,
  UserRepository,
} from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  NotFoundError,
  ok,
  Result,
  ValidationErrors,
  validate,
} from '@/shared/domain/common';
import { UpdateUserCommand } from './update-user.command';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateUserCommand,
  ): Promise<
    Result<void, NotFoundError | EmailAlreadyExistsError | ConcurrencyError | ValidationErrors>
  > {
    return this.transactionManager.execute(async () => {
      const userId = UserId.from(command.userId);
      const user = await this.userRepository.findById(userId);

      if (!user) {
        return err(new NotFoundError('user', userId));
      }

      const validation = validate({
        name: UserName.create(command.name),
      });

      if (validation.isErr()) {
        return err(validation.error);
      }

      const { name } = validation.value;
      user.changeName(name);
      const saveResult = await this.userRepository.save(user);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }
}
