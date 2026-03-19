import {
  AggregateRoot,
  err,
  ok,
  RequiredError,
  Result,
  ValidationErrors,
} from '@/shared/domain/common';
import { NotificationChannelId } from './notification-channel.id';
import { NotificationRuleId } from './notification-rule.id';
import { NotificationScopeType } from './notification-scope-type.enum';
import { NotificationTargetId } from './notification-target.id';
import { NotificationRuleDedupeWindowSec } from './value-objects/notification-rule-dedupe-window-sec.vo';
import { NotificationRuleName } from './value-objects/notification-rule-name.vo';
import { NotificationRuleRateLimitCount } from './value-objects/notification-rule-rate-limit-count.vo';
import { NotificationRuleRateLimitWindowSec } from './value-objects/notification-rule-rate-limit-window-sec.vo';
import { NotificationRuleText } from './value-objects/notification-rule-text.vo';

export interface NotificationTarget {
  id: NotificationTargetId;
  channelId: NotificationChannelId;
  address: string | null;
}

export interface NotificationRuleProps {
  name: NotificationRuleName;
  event: string;
  scopeType: NotificationScopeType;
  scopeValue: NotificationRuleText | null;
  metricKey: NotificationRuleText | null;
  severity: NotificationRuleText | null;
  environment: NotificationRuleText | null;
  rateLimitCount: NotificationRuleRateLimitCount;
  rateLimitWindowSec: NotificationRuleRateLimitWindowSec;
  dedupeWindowSec: NotificationRuleDedupeWindowSec;
  messageTemplate: NotificationRuleText | null;
  isEnabled: boolean;
  targets: NotificationTarget[];
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateNotificationRuleProps {
  name: NotificationRuleName;
  event: string;
  scopeType: NotificationScopeType | null;
  scopeValue: NotificationRuleText | null;
  metricKey: NotificationRuleText | null;
  severity: NotificationRuleText | null;
  environment: NotificationRuleText | null;
  rateLimitCount: NotificationRuleRateLimitCount | null;
  rateLimitWindowSec: NotificationRuleRateLimitWindowSec | null;
  dedupeWindowSec: NotificationRuleDedupeWindowSec | null;
  messageTemplate: NotificationRuleText | null;
  isEnabled: boolean | null;
  targets: Array<{
    channelId: NotificationChannelId;
    address: string | null;
  }>;
}

export class NotificationRule extends AggregateRoot<NotificationRuleProps, NotificationRuleId> {
  private static readonly DEFAULTS = {
    scopeType: NotificationScopeType.ANY,
    rateLimitCount: NotificationRuleRateLimitCount.reconstitute(50),
    rateLimitWindowSec: NotificationRuleRateLimitWindowSec.reconstitute(60),
    dedupeWindowSec: NotificationRuleDedupeWindowSec.reconstitute(300),
    isEnabled: true,
  } as const;

  private constructor(props: NotificationRuleProps, id: NotificationRuleId) {
    super(props, id);
  }

  static create(props: CreateNotificationRuleProps): Result<NotificationRule, ValidationErrors> {
    if (props.targets.length === 0) {
      return err(new ValidationErrors([new RequiredError('targets')]));
    }

    return ok(
      new NotificationRule(
        {
          name: props.name,
          event: props.event,
          scopeType: props.scopeType ?? NotificationRule.DEFAULTS.scopeType,
          scopeValue: props.scopeValue,
          metricKey: props.metricKey,
          severity: props.severity,
          environment: props.environment,
          rateLimitCount: props.rateLimitCount ?? NotificationRule.DEFAULTS.rateLimitCount,
          rateLimitWindowSec:
            props.rateLimitWindowSec ?? NotificationRule.DEFAULTS.rateLimitWindowSec,
          dedupeWindowSec: props.dedupeWindowSec ?? NotificationRule.DEFAULTS.dedupeWindowSec,
          messageTemplate: props.messageTemplate,
          isEnabled: props.isEnabled ?? NotificationRule.DEFAULTS.isEnabled,
          targets: props.targets.map((target) => ({
            id: NotificationTargetId.generate(),
            channelId: target.channelId,
            address: target.address,
          })),
          createdAt: new Date(),
          updatedAt: null,
        },
        NotificationRuleId.generate(),
      ),
    );
  }

  static reconstitute(props: NotificationRuleProps, id: NotificationRuleId): NotificationRule {
    return new NotificationRule(props, id);
  }

  get name(): string {
    return this.props.name.value;
  }

  get event(): string {
    return this.props.event;
  }

  get scopeType(): NotificationScopeType {
    return this.props.scopeType;
  }

  get scopeValue(): string | null {
    return this.props.scopeValue?.value ?? null;
  }

  get metricKey(): string | null {
    return this.props.metricKey?.value ?? null;
  }

  get severity(): string | null {
    return this.props.severity?.value ?? null;
  }

  get environment(): string | null {
    return this.props.environment?.value ?? null;
  }

  get rateLimitCount(): number {
    return this.props.rateLimitCount.value;
  }

  get rateLimitWindowSec(): number {
    return this.props.rateLimitWindowSec.value;
  }

  get dedupeWindowSec(): number {
    return this.props.dedupeWindowSec.value;
  }

  get messageTemplate(): string | null {
    return this.props.messageTemplate?.value ?? null;
  }

  get isEnabled(): boolean {
    return this.props.isEnabled;
  }

  get targets(): ReadonlyArray<NotificationTarget> {
    return this.props.targets;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }
  changeName(name: NotificationRuleName): void {
    if (name.equals(this.props.name)) return;

    this.props.name = name;
    this.touch();
  }
  changeEvent(event: string): void {
    if (event === this.props.event) return;

    this.props.event = event;
    this.touch();
  }
  changeScopeType(scopeType: NotificationScopeType): void {
    if (scopeType === this.props.scopeType) return;

    this.props.scopeType = scopeType;
    this.touch();
  }
  changeScopeValue(scopeValue: NotificationRuleText | null): void {
    if (this.hasSameOptionalText(scopeValue, this.props.scopeValue)) return;

    this.props.scopeValue = scopeValue;
    this.touch();
  }
  changeMetricKey(metricKey: NotificationRuleText | null): void {
    if (this.hasSameOptionalText(metricKey, this.props.metricKey)) return;

    this.props.metricKey = metricKey;
    this.touch();
  }
  changeSeverity(severity: NotificationRuleText | null): void {
    if (this.hasSameOptionalText(severity, this.props.severity)) return;

    this.props.severity = severity;
    this.touch();
  }
  changeEnvironment(environment: NotificationRuleText | null): void {
    if (this.hasSameOptionalText(environment, this.props.environment)) return;

    this.props.environment = environment;
    this.touch();
  }
  changeRateLimitCount(rateLimitCount: NotificationRuleRateLimitCount | null): void {
    const next = rateLimitCount ?? NotificationRule.DEFAULTS.rateLimitCount;
    if (next.equals(this.props.rateLimitCount)) return;

    this.props.rateLimitCount = next;
    this.touch();
  }
  changeRateLimitWindowSec(rateLimitWindowSec: NotificationRuleRateLimitWindowSec | null): void {
    const next = rateLimitWindowSec ?? NotificationRule.DEFAULTS.rateLimitWindowSec;
    if (next.equals(this.props.rateLimitWindowSec)) return;

    this.props.rateLimitWindowSec = next;
    this.touch();
  }
  changeDedupeWindowSec(dedupeWindowSec: NotificationRuleDedupeWindowSec | null): void {
    const next = dedupeWindowSec ?? NotificationRule.DEFAULTS.dedupeWindowSec;
    if (next.equals(this.props.dedupeWindowSec)) return;

    this.props.dedupeWindowSec = next;
    this.touch();
  }
  changeMessageTemplate(messageTemplate: NotificationRuleText | null): void {
    if (this.hasSameOptionalText(messageTemplate, this.props.messageTemplate)) return;

    this.props.messageTemplate = messageTemplate;
    this.touch();
  }
  setEnabled(isEnabled: boolean): void {
    if (isEnabled === this.props.isEnabled) return;

    this.props.isEnabled = isEnabled;
    this.touch();
  }
  replaceTargets(
    targets: Array<{
      channelId: NotificationChannelId;
      address?: string | null;
    }>,
  ): void {
    const nextTargets = targets.map((target) => ({
      channelId: target.channelId,
      address: target.address ?? null,
    }));
    if (
      this.props.targets.length === nextTargets.length &&
      this.props.targets.every(
        (target, index) =>
          target.channelId.equals(nextTargets[index]!.channelId) &&
          target.address === nextTargets[index]!.address,
      )
    ) {
      return;
    }
    this.props.targets = nextTargets.map((target) => ({
      id: NotificationTargetId.generate(),
      channelId: target.channelId,
      address: target.address,
    }));
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private hasSameOptionalText(
    value: NotificationRuleText | null,
    current: NotificationRuleText | null,
  ): boolean {
    if (value === null || current === null) {
      return value === current;
    }
    return value.equals(current);
  }
}
