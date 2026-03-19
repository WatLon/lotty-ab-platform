import {
  GuardrailAction as PrismaGuardrailAction,
  GuardrailTrigger as PrismaGuardrailTrigger,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  GuardrailTriggerFilters,
  GuardrailTriggerOutput,
  GuardrailTriggerReadRepository,
} from '@/apps/control-api/application/guardrail';
import {
  DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION,
  PRISMA_GUARDRAIL_ACTION_BY_DOMAIN_GUARDRAIL_ACTION,
} from '@/apps/control-api/infrastructure/guardrail/guardrail.types';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

@Injectable()
export class GuardrailTriggerReadPrismaRepository implements GuardrailTriggerReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExperiment(
    experimentId: string,
    params: PaginationParams,
    filters?: GuardrailTriggerFilters,
  ): Promise<PaginatedResult<GuardrailTriggerOutput>> {
    const { limit, offset } = normalizePagination(params);

    const where = {
      experimentId,
      ...(filters?.guardrailId ? { guardrailId: filters.guardrailId } : {}),
      ...(filters?.actionTaken
        ? {
            actionTaken: PRISMA_GUARDRAIL_ACTION_BY_DOMAIN_GUARDRAIL_ACTION[filters.actionTaken],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.guardrailTrigger.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.guardrailTrigger.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toOutput(row)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(row: PrismaGuardrailTrigger): GuardrailTriggerOutput {
    return {
      id: row.id,
      guardrailId: row.guardrailId,
      metricValue: row.metricValue,
      threshold: row.threshold,
      actionTaken:
        DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION[
          row.actionTaken as PrismaGuardrailAction
        ],
      triggeredAt: row.triggeredAt,
    };
  }
}
