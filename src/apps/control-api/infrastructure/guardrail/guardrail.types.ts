import {
  Prisma,
  ComparisonOperator as PrismaComparisonOperator,
  GuardrailAction as PrismaGuardrailAction,
} from '@generated/prisma/client';
import {
  ComparisonOperator as DomainComparisonOperator,
  GuardrailAction as DomainGuardrailAction,
} from '@/apps/control-api/domain/guardrail';
export const guardrailRuleWithMetricInclude = {
  metric: {
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      formula: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.GuardrailRuleInclude;
export type GuardrailRuleWithMetric = Prisma.GuardrailRuleGetPayload<{
  include: typeof guardrailRuleWithMetricInclude;
}>;
export type GuardrailRulesByExperiment = Map<string, GuardrailRuleWithMetric[]>;
export type GuardrailRulesByWindowMinutes = Map<number, GuardrailRuleWithMetric[]>;
export const DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR: Record<
  PrismaComparisonOperator,
  DomainComparisonOperator
> = {
  GT: DomainComparisonOperator.GT,
  GTE: DomainComparisonOperator.GTE,
  LT: DomainComparisonOperator.LT,
  LTE: DomainComparisonOperator.LTE,
};
export const PRISMA_COMPARISON_OPERATOR_BY_DOMAIN_COMPARISON_OPERATOR: Record<
  DomainComparisonOperator,
  PrismaComparisonOperator
> = {
  [DomainComparisonOperator.GT]: 'GT',
  [DomainComparisonOperator.GTE]: 'GTE',
  [DomainComparisonOperator.LT]: 'LT',
  [DomainComparisonOperator.LTE]: 'LTE',
};
export const DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION: Record<
  PrismaGuardrailAction,
  DomainGuardrailAction
> = {
  PAUSE: DomainGuardrailAction.PAUSE,
  ROLLBACK: DomainGuardrailAction.ROLLBACK,
};
export const PRISMA_GUARDRAIL_ACTION_BY_DOMAIN_GUARDRAIL_ACTION: Record<
  DomainGuardrailAction,
  PrismaGuardrailAction
> = {
  [DomainGuardrailAction.PAUSE]: 'PAUSE',
  [DomainGuardrailAction.ROLLBACK]: 'ROLLBACK',
};
