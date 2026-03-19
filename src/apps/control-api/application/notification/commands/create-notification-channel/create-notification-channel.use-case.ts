import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationChannelRepository,
} from '@/apps/control-api/domain/notification';
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
import { CreateNotificationChannelCommand } from './create-notification-channel.command';

@Injectable()
export class CreateNotificationChannelUseCase {
  constructor(
    private readonly channels: NotificationChannelRepository,
    private readonly users: UserRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(command: CreateNotificationChannelCommand): Promise<
    Result<
      {
        id: string;
      },
      NotFoundError | ForbiddenError | ConcurrencyError
    >
  > {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.users.findById(actorId);

      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isAdmin()) return err(new ForbiddenError('notification', actorId));

      const channelResult = NotificationChannel.create({
        name: command.name,
        type: command.type,
        config: command.config,
        isEnabled: command.isEnabled ?? undefined,
      });

      if (channelResult.isErr()) return err(channelResult.error);

      const saveResult = await this.channels.save(channelResult.value);

      if (saveResult.isErr()) return err(saveResult.error);

      return ok({ id: channelResult.value.id.value });
    });
  }
}
