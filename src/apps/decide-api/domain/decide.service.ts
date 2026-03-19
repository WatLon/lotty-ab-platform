import { RuntimeExperimentView, RuntimeFlagView } from '@/contracts/decision-runtime';
import { TargetingRuleEvaluator, TargetingRuleParser } from '@/shared/domain/targeting';
import { BucketCalculator } from './bucket-calculator';
import { Decision } from './decision';
import { DecisionReason } from './decision-reason.enum';

export interface DecideContext {
  subjectId: string;
  attributes: Record<string, unknown>;
}

export class DecideService {
  constructor(
    private readonly targetingParser: TargetingRuleParser,
    private readonly targetingEvaluator: TargetingRuleEvaluator,
  ) {}
  decide(
    flag: RuntimeFlagView,
    experiment: RuntimeExperimentView,
    context: DecideContext,
  ): Decision {
    if (experiment.status !== 'RUNNING') {
      const reason =
        experiment?.status === 'PAUSED'
          ? DecisionReason.EXPERIMENT_PAUSED
          : DecisionReason.FLAG_DEFAULT;
      return this.build({ flag, context, reason });
    }
    if (!this.isTargetingMatched(experiment.targetingRule, context.attributes)) {
      return this.build({ flag, context, reason: DecisionReason.TARGETING_NOT_MATCHED });
    }
    const bucket = BucketCalculator.calculate(context.subjectId, experiment.id);
    if (!BucketCalculator.isInAudience(bucket, experiment.audiencePercent)) {
      return this.build({ flag, context, reason: DecisionReason.NOT_IN_AUDIENCE });
    }
    const variant = BucketCalculator.selectVariant(bucket, experiment.variants);
    if (!variant) {
      return this.build({ flag, context, reason: DecisionReason.FLAG_DEFAULT });
    }
    return this.build({
      flag,
      context,
      reason: DecisionReason.EXPERIMENT_ASSIGNED,
      experimentId: experiment.id,
      variantId: variant.id,
      value: variant.value,
    });
  }
  buildDefaultDecision(
    flag: RuntimeFlagView,
    context: DecideContext,
    reason: DecisionReason,
  ): Decision {
    return this.build({ flag, context, reason });
  }
  buildLimitExceededDecision(
    flag: RuntimeFlagView,
    experimentId: string | null,
    context: DecideContext,
  ): Decision {
    return this.build({
      flag,
      context,
      reason: DecisionReason.PARTICIPATION_LIMIT_EXCEEDED,
      experimentId: experimentId ?? undefined,
    });
  }

  private build(params: {
    flag: RuntimeFlagView;
    context: DecideContext;
    reason: DecisionReason;
    experimentId?: string;
    variantId?: string;
    value?: string;
  }): Decision {
    const { flag, context, reason } = params;
    const attrs = context.attributes;
    return {
      id: crypto.randomUUID(),
      subjectId: context.subjectId,
      flagId: flag.id,
      experimentId: params.experimentId ?? null,
      variantId: params.variantId ?? null,
      value: params.value ?? flag.defaultValue,
      reason,
      subjectAttributes: Object.keys(attrs).length > 0 ? attrs : null,
      createdAt: new Date(),
    };
  }

  private isTargetingMatched(rule: unknown, attributes: Record<string, unknown>): boolean {
    if (rule === null || rule === undefined) return true;

    const parsed = this.targetingParser.parse(rule);
    if (parsed.isErr()) return false;

    return this.targetingEvaluator.evaluate(parsed.value, attributes);
  }
}
