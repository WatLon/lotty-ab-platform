import { Injectable } from '@nestjs/common';
import {
  Flag,
  FlagDefaultValue,
  FlagKey,
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
import { CreateFlagCommand } from './create-flag.command';

@Injectable()
export class CreateFlagUseCase {
  constructor(
    private readonly flagRepository: FlagRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateFlagCommand): Promise<
    Result<
      {
        id: string;
      },
      | FlagKeyAlreadyExistsError
      | NotFoundError
      | ForbiddenError
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

      if (!actor.isAdmin()) {
        return err(new ForbiddenError('flag', actorId));
      }

      const validation = validate({
        key: FlagKey.create(command.key),
        defaultValue: FlagDefaultValue.create(command.defaultValue, command.valueType),
      });

      if (validation.isErr()) {
        return err(validation.error);
      }

      const { key, defaultValue } = validation.value;
      const existing = await this.flagRepository.findByKey(key);

      if (existing) {
        return err(new FlagKeyAlreadyExistsError(key));
      }

      const flagResult = Flag.create({
        key,
        valueType: command.valueType,
        defaultValue,
        description: command.description,
      });

      if (flagResult.isErr()) {
        return err(flagResult.error);
      }

      const flag = flagResult.value;
      const saveResult = await this.flagRepository.save(flag);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok({ id: flag.id.value });
    });
  }
}
