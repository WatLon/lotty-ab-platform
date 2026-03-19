import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppLogger } from '@/shared/application';
import { DistributedLockService } from '@/shared/infrastructure/cache/distributed-lock.service';
import { GuardrailActionExecutorService } from './guardrail-action-executor.service';
import { GuardrailEvaluatorService } from './guardrail-evaluator.service';
import { GuardrailRuleLoaderService } from './guardrail-rule-loader.service';

@Injectable()
export class GuardrailCheckService {
  private static readonly MAX_EXECUTION_MS = 55000;
  private static readonly LOCK_KEY = 'cron:guardrail-check';
  private static readonly LOCK_TTL_SECONDS = 58;
  private nextStartOffset = 0;

  constructor(
    private readonly lockService: DistributedLockService,
    private readonly ruleLoader: GuardrailRuleLoaderService,
    private readonly evaluator: GuardrailEvaluatorService,
    private readonly actionExecutor: GuardrailActionExecutorService,
    private readonly appLogger: AppLogger,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkGuardrails(): Promise<void> {
    const result = await this.lockService.withLock(
      GuardrailCheckService.LOCK_KEY,
      { ttlSeconds: GuardrailCheckService.LOCK_TTL_SECONDS },
      () => this.executeCheck(),
    );
    if (result === null) {
      this.appLogger.debug({
        event: 'system.guardrails.skipped',
        domain: 'system',
        operation: 'GuardrailCheckService.checkGuardrails',
        status: 'success',
        meta: { reason: 'lock_held_by_another_instance' },
      });
    }
  }

  private async executeCheck(): Promise<void> {
    const startedAt = Date.now();

    try {
      const rulesByExperiment = await this.ruleLoader.loadGroupedRunningRules();
      if (rulesByExperiment.size === 0) return;

      const experiments = Array.from(rulesByExperiment.entries());
      const offset = this.nextStartOffset % experiments.length;
      const ordered =
        offset === 0
          ? experiments
          : [...experiments.slice(offset), ...experiments.slice(0, offset)];

      let processed = 0;
      let timedOut = false;

      for (const [experimentId, rules] of ordered) {
        if (Date.now() - startedAt > GuardrailCheckService.MAX_EXECUTION_MS) {
          timedOut = true;
          break;
        }

        try {
          const breaches = await this.evaluator.evaluateExperiment(experimentId, rules);

          if (breaches.length > 0) {
            await this.actionExecutor.execute(experimentId, breaches);
          }
        } catch (error) {
          this.appLogger.error(
            {
              event: 'system.guardrails.experiment.check.failed',
              domain: 'system',
              operation: 'GuardrailCheckService.executeCheck',
              status: 'failure',
              meta: { experimentId },
            },
            error,
            'guardrail check failed for experiment',
          );
        }
        processed++;
      }

      this.nextStartOffset =
        rulesByExperiment.size > 0
          ? (this.nextStartOffset + processed) % rulesByExperiment.size
          : 0;

      if (timedOut) {
        this.appLogger.warn({
          event: 'system.guardrails.worker.timeout',
          domain: 'system',
          operation: 'GuardrailCheckService.executeCheck',
          status: 'failure',
          meta: {
            totalExperiments: rulesByExperiment.size,
            processedExperiments: processed,
            elapsedMs: Date.now() - startedAt,
          },
        });
      }

      this.appLogger.debug({
        event: 'system.guardrails.completed',
        domain: 'system',
        operation: 'GuardrailCheckService.executeCheck',
        status: 'success',
        meta: {
          totalExperiments: rulesByExperiment.size,
          processedExperiments: processed,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      this.appLogger.error(
        {
          event: 'system.guardrails.worker.failed',
          domain: 'system',
          operation: 'GuardrailCheckService.executeCheck',
          status: 'failure',
          durationMs: Date.now() - startedAt,
        },
        error,
        'guardrails worker failed',
      );
    }
  }
}
