import {
  Prisma,
  ExperimentOutcomeType as PrismaExperimentOutcomeType,
  ExperimentStatus as PrismaExperimentStatus,
  ReviewDecision as PrismaReviewDecision,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  ExperimentOutcomeOutput,
  ExperimentOutput,
  ExperimentReadRepository,
  ListExperimentsParams,
  ReviewOutput,
  VariantOutput,
} from '@/apps/control-api/application/experiment';
import {
  ExperimentOutcomeType,
  ExperimentStatus,
  ReviewDecision,
} from '@/apps/control-api/domain/experiment';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

const EXPERIMENT_READ_INCLUDE = {
  variants: true,
  metrics: true,
  outcome: true,
  reviews: true,
} as const;

type PrismaExperimentRead = Prisma.ExperimentGetPayload<{
  include: typeof EXPERIMENT_READ_INCLUDE;
}>;

const DOMAIN_STATUS_BY_PRISMA_STATUS: Record<PrismaExperimentStatus, ExperimentStatus> = {
  DRAFT: ExperimentStatus.DRAFT,
  IN_REVIEW: ExperimentStatus.IN_REVIEW,
  APPROVED: ExperimentStatus.APPROVED,
  REJECTED: ExperimentStatus.REJECTED,
  RUNNING: ExperimentStatus.RUNNING,
  PAUSED: ExperimentStatus.PAUSED,
  COMPLETED: ExperimentStatus.COMPLETED,
  ARCHIVED: ExperimentStatus.ARCHIVED,
};

const DOMAIN_OUTCOME_BY_PRISMA_OUTCOME: Record<PrismaExperimentOutcomeType, ExperimentOutcomeType> =
  {
    ROLLOUT_WINNER: ExperimentOutcomeType.ROLLOUT_WINNER,
    ROLLBACK: ExperimentOutcomeType.ROLLBACK,
    NO_EFFECT: ExperimentOutcomeType.NO_EFFECT,
  };

const DOMAIN_REVIEW_DECISION_BY_PRISMA: Record<PrismaReviewDecision, ReviewDecision> = {
  APPROVED: ReviewDecision.APPROVED,
  REJECTED: ReviewDecision.REJECTED,
  CHANGES_REQUESTED: ReviewDecision.CHANGES_REQUESTED,
};

const PRISMA_STATUS_BY_DOMAIN_STATUS: Record<ExperimentStatus, PrismaExperimentStatus> = {
  [ExperimentStatus.DRAFT]: PrismaExperimentStatus.DRAFT,
  [ExperimentStatus.IN_REVIEW]: PrismaExperimentStatus.IN_REVIEW,
  [ExperimentStatus.APPROVED]: PrismaExperimentStatus.APPROVED,
  [ExperimentStatus.REJECTED]: PrismaExperimentStatus.REJECTED,
  [ExperimentStatus.RUNNING]: PrismaExperimentStatus.RUNNING,
  [ExperimentStatus.PAUSED]: PrismaExperimentStatus.PAUSED,
  [ExperimentStatus.COMPLETED]: PrismaExperimentStatus.COMPLETED,
  [ExperimentStatus.ARCHIVED]: PrismaExperimentStatus.ARCHIVED,
};

@Injectable()
export class ExperimentReadPrismaRepository implements ExperimentReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ExperimentOutput | null> {
    const experiment = await this.prisma.experiment.findUnique({
      where: { id },
      include: EXPERIMENT_READ_INCLUDE,
    });

    if (!experiment) {
      return null;
    }

    return this.toOutput(experiment);
  }

  async findAll(
    params: ListExperimentsParams & PaginationParams,
  ): Promise<PaginatedResult<ExperimentOutput>> {
    const where = this.buildWhereClause(params);
    const { limit, offset } = normalizePagination(params);

    const [experiments, total] = await Promise.all([
      this.prisma.experiment.findMany({
        where,
        include: EXPERIMENT_READ_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.experiment.count({ where }),
    ]);

    return {
      data: experiments.map((experiment) => this.toOutput(experiment)),
      total,
      limit,
      offset,
    };
  }

  private buildWhereClause(
    params: ListExperimentsParams & PaginationParams,
  ): Prisma.ExperimentWhereInput {
    return {
      ...(params.flagId && { flagId: params.flagId }),
      ...(params.status && { status: PRISMA_STATUS_BY_DOMAIN_STATUS[params.status] }),
      ...(params.ownerId && { ownerId: params.ownerId }),
    };
  }

  private toOutput(raw: PrismaExperimentRead): ExperimentOutput {
    const metricIds = raw.metrics.map((metric) => metric.metricId);
    const primaryMetricId = raw.metrics.find((metric) => metric.isPrimary)?.metricId ?? null;

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      flagId: raw.flagId,
      status: DOMAIN_STATUS_BY_PRISMA_STATUS[raw.status],
      conflictDomain: raw.conflictDomain ?? null,
      priority: raw.priority,
      audiencePercent: raw.audiencePercent,
      targetingRule: raw.targetingRule,
      ownerId: raw.ownerId,
      variants: this.mapVariants(raw),
      metricIds,
      primaryMetricId,
      reviews: this.mapReviews(raw),
      outcome: this.mapOutcome(raw),
      startedAt: raw.startedAt,
      pausedAt: raw.pausedAt,
      completedAt: raw.completedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private mapVariants(raw: PrismaExperimentRead): VariantOutput[] {
    return raw.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      value: variant.value,
      weight: variant.weight,
      isControl: variant.isControl,
    }));
  }

  private mapReviews(raw: PrismaExperimentRead): ReviewOutput[] {
    return raw.reviews.map((review) => ({
      id: review.id,
      reviewerId: review.reviewerId,
      decision: DOMAIN_REVIEW_DECISION_BY_PRISMA[review.decision],
      comment: review.comment,
      createdAt: review.createdAt,
    }));
  }

  private mapOutcome(raw: PrismaExperimentRead): ExperimentOutcomeOutput | null {
    if (!raw.outcome) {
      return null;
    }

    return {
      type: DOMAIN_OUTCOME_BY_PRISMA_OUTCOME[raw.outcome.outcome],
      winnerVariantId: raw.outcome.winnerVariantId,
      comment: raw.outcome.comment,
      decidedById: raw.outcome.decidedById,
      decidedAt: raw.outcome.decidedAt,
    };
  }
}
