import { Injectable } from '@nestjs/common';
import {
  NotificationChannelId,
  NotificationChannelRepository,
  NotificationRule,
  NotificationRuleDedupeWindowSec,
  NotificationRuleId,
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
import { UpdateNotificationRuleCommand } from './update-notification-rule.command';

interface ParsedPatch {
  name?: NotificationRuleName;
  scopeValue?: NotificationRuleText | null;
  metricKey?: NotificationRuleText | null;
  severity?: NotificationRuleText | null;
  environment?: NotificationRuleText | null;
  messageTemplate?: NotificationRuleText | null;
  rateLimitCount?: NotificationRuleRateLimitCount | null;
  rateLimitWindowSec?: NotificationRuleRateLimitWindowSec | null;
  dedupeWindowSec?: NotificationRuleDedupeWindowSec | null;
}

interface ResolvedTarget {
  channelId: NotificationChannelId;
  address: string | null;
}

@Injectable()
export class UpdateNotificationRuleUseCase {
  constructor(
    private readonly rules: NotificationRuleRepository,
    private readonly channels: NotificationChannelRepository,
    private readonly users: UserRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateNotificationRuleCommand,
  ): Promise<Result<void, NotFoundError | ForbiddenError | ValidationErrors | ConcurrencyError>> {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.users.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isAdmin()) return err(new ForbiddenError('notification', actorId));

      const ruleId = NotificationRuleId.from(command.ruleId);
      const rule = await this.rules.findById(ruleId);
      if (!rule) return err(new NotFoundError('notificationRule', ruleId));

      const parseResult = this.parseInputs(command);
      if (parseResult.isErr()) return err(parseResult.error);

      if (command.targets !== undefined) {
        const targetsResult = await this.verifyTargets(command.targets);
        if (targetsResult.isErr()) return err(targetsResult.error);

        rule.replaceTargets(targetsResult.value);
      }

      this.applyPatch(rule, parseResult.value, command);

      const saveResult = await this.rules.save(rule);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }

  private parseInputs(
    command: UpdateNotificationRuleCommand,
  ): Result<ParsedPatch, ValidationErrors> {
    const result = Result.combineAll({
      name: Result.validateOptional(command.name, NotificationRuleName.create),
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

  private applyPatch(
    rule: NotificationRule,
    parsed: ParsedPatch,
    command: UpdateNotificationRuleCommand,
  ): void {
    if (parsed.name !== undefined) rule.changeName(parsed.name);
    if (parsed.scopeValue !== undefined) rule.changeScopeValue(parsed.scopeValue);
    if (parsed.metricKey !== undefined) rule.changeMetricKey(parsed.metricKey);
    if (parsed.severity !== undefined) rule.changeSeverity(parsed.severity);
    if (parsed.environment !== undefined) rule.changeEnvironment(parsed.environment);
    if (parsed.messageTemplate !== undefined) rule.changeMessageTemplate(parsed.messageTemplate);

    if (parsed.rateLimitCount !== undefined) rule.changeRateLimitCount(parsed.rateLimitCount);
    if (parsed.rateLimitWindowSec !== undefined)
      rule.changeRateLimitWindowSec(parsed.rateLimitWindowSec);
    if (parsed.dedupeWindowSec !== undefined) rule.changeDedupeWindowSec(parsed.dedupeWindowSec);

    if (command.event !== undefined) rule.changeEvent(command.event);
    if (command.scopeType !== undefined) rule.changeScopeType(command.scopeType);
    if (command.isEnabled !== undefined) rule.setEnabled(command.isEnabled);
  }

  private async verifyTargets(
    targets: UpdateNotificationRuleCommand['targets'] & {},
  ): Promise<Result<ResolvedTarget[], NotFoundError>> {
    const resolved: ResolvedTarget[] = [];

    for (const target of targets) {
      const channelId = NotificationChannelId.from(target.channelId);
      const channel = await this.channels.findById(channelId);
      if (!channel) return err(new NotFoundError('notificationChannel', channelId));

      resolved.push({ channelId, address: target.address ?? null });
    }

    return ok(resolved);
  }
}
