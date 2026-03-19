import { Injectable } from '@nestjs/common';
import {
  NotificationChannelId,
  NotificationChannelRepository,
  NotificationRule,
  NotificationRuleDedupeWindowSec,
  NotificationRuleName,
  NotificationRuleRateLimitCount,
  NotificationRuleRateLimitWindowSec,
  NotificationRuleRepository,
  NotificationRuleText,
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
  ValidationErrors,
} from '@/shared/domain/common';
import { CreateNotificationRuleCommand } from './create-notification-rule.command';

interface ParsedFields {
  name: NotificationRuleName;
  scopeValue: NotificationRuleText | null;
  metricKey: NotificationRuleText | null;
  severity: NotificationRuleText | null;
  environment: NotificationRuleText | null;
  messageTemplate: NotificationRuleText | null;
  rateLimitCount: NotificationRuleRateLimitCount | null;
  rateLimitWindowSec: NotificationRuleRateLimitWindowSec | null;
  dedupeWindowSec: NotificationRuleDedupeWindowSec | null;
}

interface ResolvedTarget {
  channelId: NotificationChannelId;
  address: string | null;
}

@Injectable()
export class CreateNotificationRuleUseCase {
  constructor(
    private readonly rules: NotificationRuleRepository,
    private readonly channels: NotificationChannelRepository,
    private readonly users: UserRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(
    command: CreateNotificationRuleCommand,
  ): Promise<
    Result<{ id: string }, NotFoundError | ForbiddenError | ConcurrencyError | ValidationErrors>
  > {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.users.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isAdmin()) return err(new ForbiddenError('notification', actorId));

      const parseResult = this.parseInputs(command);
      if (parseResult.isErr()) return err(parseResult.error);

      const targetsResult = await this.verifyTargets(command.targets);
      if (targetsResult.isErr()) return err(targetsResult.error);

      const ruleResult = NotificationRule.create({
        ...parseResult.value,
        event: command.event,
        scopeType: command.scopeType ?? null,
        isEnabled: command.isEnabled ?? null,
        targets: targetsResult.value,
      });
      if (ruleResult.isErr()) return err(ruleResult.error);

      const saveResult = await this.rules.save(ruleResult.value);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok({ id: ruleResult.value.id.value });
    });
  }

  private parseInputs(
    command: CreateNotificationRuleCommand,
  ): Result<ParsedFields, ValidationErrors> {
    const result = Result.combineAll({
      name: NotificationRuleName.create(command.name),
      scopeValue: Result.validateNullable(command.scopeValue, (v) =>
        NotificationRuleText.create(v, 'scopeValue'),
      ),
      metricKey: Result.validateNullable(command.metricKey, (v) =>
        NotificationRuleText.create(v, 'metricKey'),
      ),
      severity: Result.validateNullable(command.severity, (v) =>
        NotificationRuleText.create(v, 'severity'),
      ),
      environment: Result.validateNullable(command.environment, (v) =>
        NotificationRuleText.create(v, 'environment'),
      ),
      messageTemplate: Result.validateNullable(command.messageTemplate, (v) =>
        NotificationRuleText.create(v, 'messageTemplate'),
      ),
      rateLimitCount: Result.validateNullable(
        command.rateLimitCount,
        NotificationRuleRateLimitCount.create,
      ),
      rateLimitWindowSec: Result.validateNullable(
        command.rateLimitWindowSec,
        NotificationRuleRateLimitWindowSec.create,
      ),
      dedupeWindowSec: Result.validateNullable(
        command.dedupeWindowSec,
        NotificationRuleDedupeWindowSec.create,
      ),
    });

    if (result.isErr()) return err(new ValidationErrors(result.error));

    return ok(result.value);
  }

  private async verifyTargets(
    targets: CreateNotificationRuleCommand['targets'],
  ): Promise<Result<ResolvedTarget[], NotFoundError>> {
    const resolved: ResolvedTarget[] = [];

    for (const target of targets) {
      const channelId = NotificationChannelId.from(target.channelId);
      const channel = await this.channels.findById(channelId);
      if (!channel) return err(new NotFoundError('notificationChannel', channelId));

      resolved.push({ channelId, address: target.address });
    }

    return ok(resolved);
  }
}
