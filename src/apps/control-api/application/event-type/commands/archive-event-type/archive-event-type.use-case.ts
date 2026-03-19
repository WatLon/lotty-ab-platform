import { Injectable } from '@nestjs/common';
import {
  EventTypeId,
  EventTypeKeyAlreadyExistsError,
  EventTypeRepository,
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
} from '@/shared/domain/common';
import { ArchiveEventTypeCommand } from './archive-event-type.command';

@Injectable()
export class ArchiveEventTypeUseCase {
  constructor(
    private readonly eventTypeRepository: EventTypeRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    command: ArchiveEventTypeCommand,
  ): Promise<
    Result<void, NotFoundError | ForbiddenError | EventTypeKeyAlreadyExistsError | ConcurrencyError>
  > {
    return this.transactionManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.userRepository.findById(actorId);

      if (!actor) return err(new NotFoundError('user', actorId));

      const id = EventTypeId.from(command.eventTypeId);

      if (!actor.isAdmin()) return err(new ForbiddenError('eventType', id));

      const eventType = await this.eventTypeRepository.findById(id);

      if (!eventType) return err(new NotFoundError('eventType', id));

      eventType.archive();

      const saveResult = await this.eventTypeRepository.save(eventType);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
