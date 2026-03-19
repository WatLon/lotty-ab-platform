import { NotificationDeliveryStatus, Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';
import { AppLogger } from '@/shared/application';
import { isPlainObject } from '@/shared/domain/common';
import { TypedConfigService } from '@/shared/infrastructure/config';
import {
  PrismaService,
  toPrismaJson,
  toPrismaNullableJson,
} from '@/shared/infrastructure/persistence';
import { NotificationRenderer } from './notification.renderer';
import { NotificationSender, readJsonString } from './notification-sender.interface';
import { SlackSender } from './slack.sender';
import { TelegramSender } from './telegram.sender';

const RULE_INCLUDE = {
  targets: { include: { channel: true } },
} satisfies Prisma.NotificationRuleInclude;
type RuleWithTargets = Prisma.NotificationRuleGetPayload<{
  include: typeof RULE_INCLUDE;
}>;
type Target = RuleWithTargets['targets'][number];

@Injectable()
export class NotificationDispatcher {
  private readonly senders: Record<string, NotificationSender>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TypedConfigService,
    private readonly renderer: NotificationRenderer,
    slackSender: SlackSender,
    telegramSender: TelegramSender,
    private readonly appLogger: AppLogger,
  ) {
    this.senders = { SLACK: slackSender, TELEGRAM: telegramSender };
  }

  async dispatch(event: ControlDomainEventEnvelope): Promise<void> {
    if (event.aggregateType !== 'Experiment') return;

    const experiment = await this.prisma.experiment.findUnique({
      where: { id: event.aggregateId },
      select: { id: true, name: true, ownerId: true, flag: { select: { key: true } } },
    });
    if (!experiment) return;

    const rules = await this.prisma.notificationRule.findMany({
      where: {
        event: event.eventName,
        isEnabled: true,
        OR: [
          { scopeType: 'ANY' },
          { scopeType: 'EXPERIMENT', scopeValue: experiment.id },
          { scopeType: 'FLAG', scopeValue: experiment.flag.key },
          { scopeType: 'OWNER', scopeValue: experiment.ownerId },
        ],
      },
      include: RULE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    if (rules.length === 0) return;

    const payload = isPlainObject(event.payload) ? event.payload : {};
    const environment = this.config.get('NODE_ENV');

    for (const rule of rules) {
      if (rule.environment && rule.environment !== environment) continue;

      if (rule.metricKey) {
        const keys = Array.isArray(payload.metricKeys) ? payload.metricKeys : [];
        if (!keys.includes(rule.metricKey)) continue;
      }

      const message = this.renderer.render(rule.messageTemplate, {
        event,
        payload,
        experimentId: experiment.id,
        experimentName: experiment.name,
        flagKey: experiment.flag.key,
        ownerId: experiment.ownerId,
        severity: rule.severity,
        environment,
      });

      for (const target of rule.targets) {
        const delivery = await this.resolveDelivery(rule, target, event, message);

        try {
          await this.prisma.notificationDelivery.create({
            data: {
              sourceEventId: event.eventId,
              ruleId: rule.id,
              targetId: target.id,
              channelId: target.channelId,
              status: delivery.status,
              payload: toPrismaJson(
                {
                  eventName: event.eventName,
                  aggregateId: event.aggregateId,
                  occurredOn: event.occurredOn,
                  ruleName: rule.name,
                  message,
                  context: {
                    experimentId: experiment.id,
                    experimentName: experiment.name,
                    flagKey: experiment.flag.key,
                    ownerId: experiment.ownerId,
                  },
                },
                'Delivery payload not serializable',
              ),
              response: toPrismaNullableJson(delivery.response, {
                nullSentinel: 'db',
                errorMessage: 'Delivery response not serializable',
              }),
              errorMessage: delivery.errorMessage,
              attempt: 1,
              sentAt: delivery.status === NotificationDeliveryStatus.SENT ? new Date() : null,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            continue;
          }

          throw error;
        }

        if (delivery.status === NotificationDeliveryStatus.SENT) {
          this.appLogger.info({
            event: 'notification.sent',
            domain: 'application',
            operation: 'NotificationDispatcher.dispatch',
            status: 'success',
            meta: {
              ruleId: rule.id,
              targetId: target.id,
              channelId: target.channelId,
              eventName: event.eventName,
            },
          });
        } else if (delivery.status === NotificationDeliveryStatus.FAILED) {
          this.appLogger.warn({
            event: 'notification.failed',
            domain: 'application',
            operation: 'NotificationDispatcher.dispatch',
            status: 'failure',
            meta: {
              ruleId: rule.id,
              targetId: target.id,
              channelId: target.channelId,
              eventName: event.eventName,
              error: delivery.errorMessage,
            },
          });
        }
      }
    }
  }

  private async resolveDelivery(
    rule: RuleWithTargets,
    target: Target,
    event: ControlDomainEventEnvelope,
    message: string,
  ): Promise<{
    status: NotificationDeliveryStatus;
    response: unknown;
    errorMessage: string | null;
  }> {
    if (!target.channel.isEnabled) {
      return {
        status: NotificationDeliveryStatus.FAILED,
        response: null,
        errorMessage: 'Channel is disabled',
      };
    }

    if (rule.dedupeWindowSec > 0) {
      const since = new Date(Date.now() - rule.dedupeWindowSec * 1000);
      const recent = await this.prisma.notificationDelivery.findFirst({
        where: { ruleId: rule.id, targetId: target.id, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      });
      if (recent && readJsonString(recent.payload, 'eventName') === event.eventName) {
        return {
          status: NotificationDeliveryStatus.SUPPRESSED_DEDUP,
          response: null,
          errorMessage: null,
        };
      }
    }

    if (rule.rateLimitCount > 0 && rule.rateLimitWindowSec > 0) {
      const since = new Date(Date.now() - rule.rateLimitWindowSec * 1000);
      const count = await this.prisma.notificationDelivery.count({
        where: {
          ruleId: rule.id,
          targetId: target.id,
          status: NotificationDeliveryStatus.SENT,
          createdAt: { gte: since },
        },
      });
      if (count >= rule.rateLimitCount) {
        return {
          status: NotificationDeliveryStatus.SUPPRESSED_RATE_LIMIT,
          response: null,
          errorMessage: null,
        };
      }
    }

    const sender = this.senders[target.channel.type];
    if (!sender) {
      return {
        status: NotificationDeliveryStatus.FAILED,
        response: null,
        errorMessage: `Unsupported channel: ${target.channel.type}`,
      };
    }

    const result = await sender.send({
      channelConfig: target.channel.config,
      targetAddress: target.address,
      message,
    });
    return {
      status: result.ok ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
      response: result.response,
      errorMessage: result.errorMessage,
    };
  }
}
