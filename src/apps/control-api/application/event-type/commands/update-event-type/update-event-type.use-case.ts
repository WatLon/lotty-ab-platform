import { Injectable } from '@nestjs/common';
import {
  EventTypeDescription,
  EventTypeId,
  EventTypeKeyAlreadyExistsError,
  EventTypeName,
  EventTypeRepository,
  EventTypeSchema,
} from '@/apps/control-api/domain/event-type';
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
} from '@/shared/domain/common';
import { UpdateEventTypeCommand } from './update-event-type.command';

@Injectable()
export class UpdateEventTypeUseCase {
  constructor(
    private readonly eventTypeRepository: EventTypeRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateEventTypeCommand,
  ): Promise<
    Result<
      void,
      | NotFoundError
      | ForbiddenError
      | ValidationErrors
      | EventTypeKeyAlreadyExistsError
      | ConcurrencyError
    >
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) return err(new NotFoundError('user', actorId));

      const id = EventTypeId.from(command.eventTypeId);

      if (!actor.isAdmin()) return err(new ForbiddenError('eventType', id));

      const eventType = await this.eventTypeRepository.findById(id);

      if (!eventType) return err(new NotFoundError('eventType', id));

      if (command.name !== undefined) {
        const name = EventTypeName.create(command.name);

        if (name.isErr()) return err(new ValidationErrors([name.error]));

        eventType.changeName(name.value);
      }

      if (command.description !== undefined) {
        const description =
          command.description === null
            ? ok(null)
            : EventTypeDescription.create(command.description);

        if (description.isErr()) return err(new ValidationErrors([description.error]));

        eventType.changeDescription(description.value);
      }

      if (command.schema !== undefined) {
        const schema = EventTypeSchema.create(command.schema);

        if (schema.isErr()) return err(new ValidationErrors([schema.error]));

        eventType.changeSchema(schema.value);
      }

      const saveResult = await this.eventTypeRepository.save(eventType);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
