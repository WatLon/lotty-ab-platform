import { ExperimentStatus } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  GuardrailRulesByExperiment,
  GuardrailRuleWithMetric,
  guardrailRuleWithMetricInclude,
} from '@/apps/control-api/infrastructure/guardrail/guardrail.types';
import { PrismaService } from '@/shared/infrastructure/persistence';

@Injectable()
export class GuardrailRuleLoaderService {
  constructor(private readonly prisma: PrismaService) {}

  async loadGroupedRunningRules(): Promise<GuardrailRulesByExperiment> {
    const rules = await this.prisma.guardrailRule.findMany({
      include: guardrailRuleWithMetricInclude,
      where: { experiment: { status: ExperimentStatus.RUNNING } },
    });
    return this.groupByExperimentId(rules);
  }

  private groupByExperimentId(rules: GuardrailRuleWithMetric[]): GuardrailRulesByExperiment {
    const rulesByExperiment = new Map<string, GuardrailRuleWithMetric[]>();

    for (const rule of rules) {
      const experimentRules = rulesByExperiment.get(rule.experimentId);

      if (experimentRules) {
        experimentRules.push(rule);
      } else {
        rulesByExperiment.set(rule.experimentId, [rule]);
      }
    }

    return rulesByExperiment;
  }
}
