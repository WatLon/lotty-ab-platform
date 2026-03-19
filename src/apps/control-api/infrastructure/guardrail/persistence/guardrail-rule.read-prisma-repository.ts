import {
  Prisma,
  ComparisonOperator as PrismaComparisonOperator,
  GuardrailAction as PrismaGuardrailAction,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  GuardrailRuleOutput,
  GuardrailRuleReadRepository,
} from '@/apps/control-api/application/guardrail';
import {
  DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR,
  DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION,
} from '@/apps/control-api/infrastructure/guardrail/guardrail.types';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

const GUARDRAIL_RULE_READ_INCLUDE = {
  metric: {
    select: {
      key: true,
      name: true,
    },
  },
} as const;

type GuardrailRuleReadRow = Prisma.GuardrailRuleGetPayload<{
  include: typeof GUARDRAIL_RULE_READ_INCLUDE;
}>;

@Injectable()
export class GuardrailRuleReadPrismaRepository implements GuardrailRuleReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExperimentAndId(
    experimentId: string,
    guardrailId: string,
  ): Promise<GuardrailRuleOutput | null> {
    const raw = await this.prisma.guardrailRule.findFirst({
      where: { id: guardrailId, experimentId },
      include: GUARDRAIL_RULE_READ_INCLUDE,
    });
    if (!raw) {
      return null;
    }
    return this.toOutput(raw);
  }

  async findByExperiment(
    experimentId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<GuardrailRuleOutput>> {
    const { limit, offset } = normalizePagination(params);
    const where = { experimentId };
    const [rules, total] = await Promise.all([
      this.prisma.guardrailRule.findMany({
        where,
        include: GUARDRAIL_RULE_READ_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.guardrailRule.count({ where }),
    ]);
    return {
      data: rules.map((rule) => this.toOutput(rule)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(raw: GuardrailRuleReadRow): GuardrailRuleOutput {
    return {
      id: raw.id,
      experimentId: raw.experimentId,
      metricId: raw.metricId,
      metricKey: raw.metric.key,
      metricName: raw.metric.name,
      threshold: raw.threshold,
      operator:
        DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR[
          raw.operator as PrismaComparisonOperator
        ],
      windowMinutes: raw.windowMinutes,
      action:
        DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION[raw.action as PrismaGuardrailAction],
      createdAt: raw.createdAt,
    };
  }
}
