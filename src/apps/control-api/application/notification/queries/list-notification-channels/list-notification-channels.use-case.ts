import { Injectable } from '@nestjs/common';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { NotificationChannelOutput } from '../../notification-channel.output';
import { NotificationChannelReadRepository } from '../../notification-channel.read-repository';

@Injectable()
export class ListNotificationChannelsUseCase {
  constructor(private readonly channels: NotificationChannelReadRepository) {}

  async execute(
    params?: PaginationParams,
  ): Promise<Result<PaginatedResult<NotificationChannelOutput>, never>> {
    return ok(await this.channels.findAll(params ?? {}));
  }
}
