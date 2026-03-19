import { Injectable } from '@nestjs/common';
import {
  EventType,
  EventTypeDescription,
  EventTypeKey,
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
  validate,
} from '@/shared/domain/common';
import { CreateEventTypeCommand } from './create-event-type.command';

@Injectable()
export class CreateEventTypeUseCase {
  constructor(
    private readonly eventTypeRepository: EventTypeRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateEventTypeCommand): Promise<
    Result<
      {
        id: string;
      },
      | EventTypeKeyAlreadyExistsError
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
        return err(new ForbiddenError('eventType', actorId));
      }

      const validation = validate({
        key: EventTypeKey.create(command.key),
        name: EventTypeName.create(command.name),
        description:
          command.description === null
            ? ok(null)
            : EventTypeDescription.create(command.description),
        schema: EventTypeSchema.create(command.schema),
      });

      if (validation.isErr()) return err(validation.error);

      const { key, name, description, schema } = validation.value;
      const existing = await this.eventTypeRepository.findByKey(key);

      if (existing) return err(new EventTypeKeyAlreadyExistsError(key));

      const eventType = Result.unwrapOk(
        EventType.create({
          key,
          name,
          description,
          schema,
          requiresExposure: command.requiresExposure,
        }),
      );

      const saveResult = await this.eventTypeRepository.save(eventType);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok({ id: eventType.id.value });
    });
  }
}
