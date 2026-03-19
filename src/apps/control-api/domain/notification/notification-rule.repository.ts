import { ConcurrencyError, Result } from '@/shared/domain/common';
import { NotificationRule } from './notification-rule.aggregate-root';
import { NotificationRuleId } from './notification-rule.id';

export abstract class NotificationRuleRepository {
  abstract findById(id: NotificationRuleId): Promise<NotificationRule | null>;

  abstract save(rule: NotificationRule): Promise<Result<void, ConcurrencyError>>;
}
