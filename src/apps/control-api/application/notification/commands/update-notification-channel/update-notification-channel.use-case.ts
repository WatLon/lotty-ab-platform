import { Injectable } from '@nestjs/common';
import {
  NotificationChannelId,
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
import { UpdateNotificationChannelCommand } from './update-notification-channel.command';

@Injectable()
export class UpdateNotificationChannelUseCase {
  constructor(
    private readonly channels: NotificationChannelRepository,
    private readonly users: UserRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateNotificationChannelCommand,
  ): Promise<Result<void, NotFoundError | ForbiddenError | ConcurrencyError>> {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.users.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isAdmin()) return err(new ForbiddenError('notification', actorId));

      const channelId = NotificationChannelId.from(command.channelId);
      const channel = await this.channels.findById(channelId);
      if (!channel) return err(new NotFoundError('notificationChannel', channelId));

      if (command.name !== undefined) channel.rename(command.name);
      if (command.config !== undefined) channel.reconfigure(command.config);
      if (command.isEnabled !== undefined) channel.setEnabled(command.isEnabled);

      const saveResult = await this.channels.save(channel);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
