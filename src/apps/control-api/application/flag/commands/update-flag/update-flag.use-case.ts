import { Injectable } from '@nestjs/common';
import {
  FlagDefaultValue,
  FlagId,
  FlagKeyAlreadyExistsError,
  FlagRepository,
} from '@/apps/control-api/domain/flag';
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
import { UpdateFlagCommand } from './update-flag.command';

@Injectable()
export class UpdateFlagUseCase {
  constructor(
    private readonly flagRepository: FlagRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateFlagCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | FlagKeyAlreadyExistsError
      | ConcurrencyError
      | ValidationErrors
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) {
        return err(new NotFoundError('user', actorId));
      }

      const flagId = FlagId.from(command.flagId);

      if (!actor.isAdmin()) {
        return err(new ForbiddenError('flag', flagId));
      }

      const flag = await this.flagRepository.findById(flagId);

      if (!flag) {
        return err(new NotFoundError('flag', flagId));
      }

      const validation = validate({
        defaultValue: FlagDefaultValue.create(command.defaultValue, flag.valueType),
      });

      if (validation.isErr()) {
        return err(validation.error);
      }

      const { defaultValue } = validation.value;
      flag.changeDefaultValue(defaultValue);

      if (command.description !== undefined) {
        flag.changeDescription(command.description);
      }

      const saveResult = await this.flagRepository.save(flag);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok(undefined);
    });
  }
}
