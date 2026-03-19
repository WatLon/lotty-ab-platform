import { Injectable } from '@nestjs/common';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { NotificationRuleOutput } from '../../notification-rule.output';
import { NotificationRuleReadRepository } from '../../notification-rule.read-repository';

@Injectable()
export class ListNotificationRulesUseCase {
  constructor(private readonly rules: NotificationRuleReadRepository) {}

  async execute(
    params?: PaginationParams,
  ): Promise<Result<PaginatedResult<NotificationRuleOutput>, never>> {
    return ok(await this.rules.findAll(params ?? {}));
  }
}
