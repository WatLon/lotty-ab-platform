import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { NotificationRuleOutput } from './notification-rule.output';

export abstract class NotificationRuleReadRepository {
  abstract findAll(params: PaginationParams): Promise<PaginatedResult<NotificationRuleOutput>>;
}
