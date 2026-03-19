import { Injectable } from '@nestjs/common';
import { isGuardrailThresholdBreached } from '@/apps/control-api/domain/guardrail';
import {
  MetricDataSource,
  MetricFormula,
  MetricFormulaData,
  MetricFormulaEvaluator,
} from '@/apps/control-api/domain/metric';
import {
  DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR,
  DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION,
  GuardrailRuleWithMetric,
} from '@/apps/control-api/infrastructure/guardrail/guardrail.types';
import { AppLogger } from '@/shared/application';
import { GuardrailBreach } from './guardrail-breach.type';

@Injectable()
export class GuardrailEvaluatorService {
  private static readonly DEFAULT_WINDOW_MINUTES = 30;

  constructor(
    private readonly metricDataSource: MetricDataSource,
    private readonly appLogger: AppLogger,
  ) {}

  async evaluateExperiment(
    experimentId: string,
    rules: GuardrailRuleWithMetric[],
  ): Promise<GuardrailBreach[]> {
    const windowEnd = new Date();
    const breaches: GuardrailBreach[] = [];
    const rulesByWindow = new Map<number, GuardrailRuleWithMetric[]>();

    for (const rule of rules) {
      const w =
        rule.windowMinutes > 0
          ? rule.windowMinutes
          : GuardrailEvaluatorService.DEFAULT_WINDOW_MINUTES;

      const list = rulesByWindow.get(w);

      if (list) list.push(rule);
      else rulesByWindow.set(w, [rule]);
    }

    for (const [windowMinutes, windowRules] of rulesByWindow) {
      const formulas = new Map<string, MetricFormulaData>();

      for (const rule of windowRules) {
        if (rule.metric.isArchived) continue;

        const result = MetricFormula.create(rule.metric.formula);

        if (result.isErr()) {
          this.appLogger.warn({
            event: 'system.guardrails.metric.formula.invalid',
            domain: 'system',
            operation: 'GuardrailEvaluatorService.evaluateExperiment',
            status: 'failure',
            meta: {
              guardrailRuleId: rule.id,
              metricId: rule.metric.id,
              reason: result.error.message,
            },
          });
          continue;
        }

        formulas.set(rule.id, result.value.data);
      }

      if (formulas.size === 0) continue;

      const windowStart = new Date(windowEnd.getTime() - windowMinutes * 60000);
      const metricKeys = MetricFormulaEvaluator.collectMetricKeys(Array.from(formulas.values()));

      const rollup = await this.metricDataSource.readRollup(
        { experimentId, from: windowStart, to: windowEnd, bucket: 'minute' },
        metricKeys,
      );

      for (const rule of windowRules) {
        const formula = formulas.get(rule.id);
        if (!formula) continue;

        const metricValue = MetricFormulaEvaluator.evaluate(formula, rollup);
        if (metricValue === null || Number.isNaN(metricValue)) continue;

        const operator = DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR[rule.operator];
        if (!isGuardrailThresholdBreached(metricValue, rule.threshold, operator)) continue;

        breaches.push({
          ruleId: rule.id,
          threshold: rule.threshold,
          action: DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION[rule.action],
          operator,
          metricKey: rule.metric.key,
          metricValue,
          windowMinutes,
        });
      }
    }

    return breaches;
  }
}
