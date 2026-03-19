import { Injectable } from '@nestjs/common';
import {
  Experiment,
  ExperimentId,
  ExperimentOutcomeType,
  ExperimentRepository,
  ExperimentStatus,
} from '@/apps/control-api/domain/experiment';
import { GuardrailAction, GuardrailTriggered } from '@/apps/control-api/domain/guardrail';
import { AppLogger } from '@/shared/application';
import { PrismaTransactionManager } from '@/shared/infrastructure/persistence';
import { GuardrailBreach } from './guardrail-breach.type';

@Injectable()
export class GuardrailActionExecutorService {
  constructor(
    private readonly txManager: PrismaTransactionManager,
    private readonly experimentRepository: ExperimentRepository,
    private readonly appLogger: AppLogger,
  ) {}

  private get db() {
    return this.txManager.getClient();
  }

  async execute(experimentId: string, breaches: GuardrailBreach[]): Promise<void> {
    await this.txManager.execute(async () => {
      const experiment = await this.experimentRepository.findById(ExperimentId.from(experimentId));

      if (!experiment) {
        this.logWarning('system.guardrails.experiment.not_found', experimentId);
        return;
      }

      if (experiment.status !== ExperimentStatus.RUNNING) {
        this.appLogger.debug({
          event: 'system.guardrails.action.skipped',
          domain: 'system',
          operation: 'GuardrailActionExecutorService.execute',
          status: 'success',
          meta: { experimentId, reason: 'experiment_not_running', status: experiment.status },
        });
        return;
      }

      const action = breaches.some((b) => b.action === GuardrailAction.ROLLBACK)
        ? GuardrailAction.ROLLBACK
        : breaches.some((b) => b.action === GuardrailAction.PAUSE)
          ? GuardrailAction.PAUSE
          : null;
      if (!action) return;

      const actionBreaches = breaches.filter((b) => b.action === action);
      const actionResult = this.applyAction(experiment, action, actionBreaches);

      if (!actionResult.ok) {
        this.logWarning('system.guardrails.action.apply.failed', experimentId, {
          action,
          reason: actionResult.reason,
        });
        return;
      }

      const saveResult = await this.experimentRepository.save(experiment);
      if (saveResult.isErr()) {
        this.logWarning('system.guardrails.action.persist.failed', experimentId, {
          action,
          reason: saveResult.error.code,
        });
        return;
      }

      await this.db.guardrailTrigger.createMany({
        data: actionBreaches.map((b) => ({
          guardrailId: b.ruleId,
          experimentId,
          metricValue: b.metricValue,
          threshold: b.threshold,
          actionTaken: action,
          triggeredAt: new Date(),
        })),
      });

      await this.txManager.stageDomainEvents([
        new GuardrailTriggered(
          { aggregateId: experimentId },
          {
            action,
            metricKeys: Array.from(new Set(actionBreaches.map((b) => b.metricKey))),
            breaches: actionBreaches.map((b) => ({
              ruleId: b.ruleId,
              metricKey: b.metricKey,
              metricValue: b.metricValue,
              threshold: b.threshold,
              operator: b.operator,
              windowMinutes: b.windowMinutes,
            })),
          },
        ),
      ]);

      this.appLogger.info({
        event: 'system.guardrails.action.applied',
        domain: 'system',
        operation: 'GuardrailActionExecutorService.execute',
        status: 'success',
        meta: {
          experimentId,
          action,
          triggerCount: actionBreaches.length,
          metricKeys: actionBreaches.map((b) => b.metricKey),
        },
      });
    });
  }

  private applyAction(
    experiment: Experiment,
    action: GuardrailAction,
    breaches: GuardrailBreach[],
  ):
    | {
        ok: true;
      }
    | {
        ok: false;
        reason: string;
      } {
    if (action === GuardrailAction.PAUSE) {
      const result = experiment.pause();
      return result.isErr() ? { ok: false, reason: result.error.code } : { ok: true };
    }

    const metricKeys = breaches.map((b) => b.metricKey).join(', ');

    const result = experiment.complete({
      type: ExperimentOutcomeType.ROLLBACK,
      winnerVariantId: null,
      comment: `Auto-rollback: guardrail triggered (${metricKeys})`,
      decidedById: experiment.ownerId,
    });

    return result.isErr() ? { ok: false, reason: result.error.code } : { ok: true };
  }

  private logWarning(
    event: string,
    experimentId: string,
    meta: Record<string, unknown> = {},
  ): void {
    this.appLogger.warn({
      event,
      domain: 'system',
      operation: 'GuardrailActionExecutorService.execute',
      status: 'failure',
      meta: { experimentId, ...meta },
    });
  }
}
