import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { NotificationChannelOutput } from './notification-channel.output';

export abstract class NotificationChannelReadRepository {
  abstract findAll(params: PaginationParams): Promise<PaginatedResult<NotificationChannelOutput>>;
}
