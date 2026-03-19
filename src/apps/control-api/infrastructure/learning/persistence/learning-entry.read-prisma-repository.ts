import {
  Prisma,
  ExperimentOutcomeType as PrismaExperimentOutcomeType,
  LearningEntry as PrismaLearningEntry,
  LearningRevision as PrismaLearningRevision,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  FindSimilarLearningsCriteria,
  LearningEntryFilters,
  LearningEntryOutput,
  LearningEntryReadRepository,
  LearningRevisionOutput,
  SimilarLearningOutput,
} from '@/apps/control-api/application/learning';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

const DOMAIN_OUTCOME_BY_PRISMA_OUTCOME: Record<PrismaExperimentOutcomeType, ExperimentOutcomeType> =
  {
    ROLLOUT_WINNER: ExperimentOutcomeType.ROLLOUT_WINNER,
    ROLLBACK: ExperimentOutcomeType.ROLLBACK,
    NO_EFFECT: ExperimentOutcomeType.NO_EFFECT,
  };

const learningEntryWithRevisionsInclude = {
  revisions: {
    orderBy: {
      revision: 'desc',
    },
  },
} satisfies Prisma.LearningEntryInclude;

type LearningEntryWithRevisions = Prisma.LearningEntryGetPayload<{
  include: typeof learningEntryWithRevisionsInclude;
}>;

interface SimilarityProfile {
  learningId: string | null;
  experimentId: string | null;
  featureKey: string | null;
  team: string | null;
  primaryMetricKey: string | null;
  guardrailMetricKeys: string[];
  tags: string[];
  platforms: string[];
  countries: string[];
  result: PrismaExperimentOutcomeType | null;
}

@Injectable()
export class LearningEntryReadPrismaRepository implements LearningEntryReadRepository {
  private static readonly DEFAULT_SIMILAR_LIMIT = 5;
  private static readonly MAX_SIMILAR_LIMIT = 20;
  private static readonly SIMILAR_CANDIDATES_LIMIT = 300;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<LearningEntryOutput | null> {
    const row = await this.prisma.learningEntry.findUnique({
      where: { id },
      include: learningEntryWithRevisionsInclude,
    });
    if (!row) return null;

    return this.toOutputWithRevisions(row);
  }

  async findAll(
    params: PaginationParams,
    filters: LearningEntryFilters,
  ): Promise<PaginatedResult<LearningEntryOutput>> {
    const { limit, offset } = normalizePagination(params);
    const where = this.buildWhere(filters);

    const [rows, total] = await Promise.all([
      this.prisma.learningEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.learningEntry.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toOutput(row)),
      total,
      limit,
      offset,
    };
  }

  async findSimilar(criteria: FindSimilarLearningsCriteria): Promise<SimilarLearningOutput[]> {
    const limit = this.normalizeSimilarLimit(criteria.limit);
    const profile = await this.loadSimilarityProfile(criteria);
    if (!profile) return [];

    const where = this.buildSimilarWhere(profile);
    if (!where) return [];

    const candidates = await this.prisma.learningEntry.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: LearningEntryReadPrismaRepository.SIMILAR_CANDIDATES_LIMIT,
    });

    return candidates
      .map((candidate) => {
        const scored = this.scoreCandidate(profile, candidate);
        return {
          learning: this.toOutput(candidate),
          score: scored.score,
          reasons: scored.reasons,
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  private buildWhere(filters: LearningEntryFilters): Prisma.LearningEntryWhereInput {
    const conditions: Prisma.LearningEntryWhereInput[] = [];

    if (!filters.includeArchived) {
      conditions.push({ isArchived: false });
    }

    if (filters.q) {
      conditions.push({
        OR: [
          { title: { contains: filters.q, mode: 'insensitive' } },
          { hypothesis: { contains: filters.q, mode: 'insensitive' } },
          { summary: { contains: filters.q, mode: 'insensitive' } },
          { notes: { contains: filters.q, mode: 'insensitive' } },
          { featureKey: { contains: filters.q, mode: 'insensitive' } },
          { team: { contains: filters.q, mode: 'insensitive' } },
          { primaryMetricKey: { contains: filters.q, mode: 'insensitive' } },
          { actionTaken: { contains: filters.q, mode: 'insensitive' } },
          { tags: { has: filters.q } },
          { countries: { has: filters.q } },
          { platforms: { has: filters.q } },
        ],
      });
    }

    if (filters.experimentId) {
      conditions.push({ experimentId: filters.experimentId });
    }

    if (filters.featureKey) {
      conditions.push({ featureKey: filters.featureKey });
    }

    if (filters.team) {
      conditions.push({ team: filters.team });
    }

    if (filters.result) {
      conditions.push({ result: filters.result });
    }

    if (filters.countries && filters.countries.length > 0) {
      conditions.push({ countries: { hasSome: filters.countries } });
    }

    if (filters.platforms && filters.platforms.length > 0) {
      conditions.push({ platforms: { hasSome: filters.platforms } });
    }

    if (filters.createdFrom || filters.createdTo) {
      conditions.push({
        createdAt: {
          ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
          ...(filters.createdTo ? { lt: filters.createdTo } : {}),
        },
      });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private async loadSimilarityProfile(
    criteria: FindSimilarLearningsCriteria,
  ): Promise<SimilarityProfile | null> {
    if (criteria.learningId) {
      const base = await this.prisma.learningEntry.findUnique({
        where: { id: criteria.learningId },
      });
      if (!base) return null;

      return {
        learningId: base.id,
        experimentId: base.experimentId,
        featureKey: base.featureKey,
        team: base.team,
        primaryMetricKey: base.primaryMetricKey,
        guardrailMetricKeys: base.guardrailMetricKeys,
        tags: base.tags,
        platforms: base.platforms,
        countries: base.countries,
        result: base.result,
      };
    }

    if (!criteria.experimentId) return null;

    const experiment = await this.prisma.experiment.findUnique({
      where: { id: criteria.experimentId },
      select: {
        id: true,
        ownerId: true,
        conflictDomain: true,
        flag: {
          select: {
            key: true,
          },
        },
        metrics: {
          where: { isPrimary: true },
          take: 1,
          select: {
            metric: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    });
    if (!experiment) return null;

    return {
      learningId: null,
      experimentId: experiment.id,
      featureKey: experiment.flag.key,
      team: experiment.ownerId,
      primaryMetricKey: experiment.metrics[0]?.metric.key ?? null,
      guardrailMetricKeys: [],
      tags: experiment.conflictDomain ? [experiment.conflictDomain] : [],
      platforms: [],
      countries: [],
      result: null,
    };
  }

  private buildSimilarWhere(profile: SimilarityProfile): Prisma.LearningEntryWhereInput | null {
    const orConditions: Prisma.LearningEntryWhereInput[] = [];

    if (profile.experimentId) orConditions.push({ experimentId: profile.experimentId });
    if (profile.featureKey) orConditions.push({ featureKey: profile.featureKey });
    if (profile.team) orConditions.push({ team: profile.team });
    if (profile.primaryMetricKey) orConditions.push({ primaryMetricKey: profile.primaryMetricKey });
    if (profile.guardrailMetricKeys.length > 0) {
      orConditions.push({ guardrailMetricKeys: { hasSome: profile.guardrailMetricKeys } });
    }

    if (profile.tags.length > 0) orConditions.push({ tags: { hasSome: profile.tags } });
    if (profile.platforms.length > 0)
      orConditions.push({ platforms: { hasSome: profile.platforms } });
    if (profile.countries.length > 0)
      orConditions.push({ countries: { hasSome: profile.countries } });

    if (orConditions.length === 0) return null;

    return {
      isArchived: false,
      ...(profile.learningId ? { id: { not: profile.learningId } } : {}),
      OR: orConditions,
    };
  }

  private scoreCandidate(
    profile: SimilarityProfile,
    candidate: PrismaLearningEntry,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (profile.experimentId && candidate.experimentId === profile.experimentId) {
      score += 60;
      reasons.push('same_experiment');
    }

    if (profile.featureKey && candidate.featureKey === profile.featureKey) {
      score += 35;
      reasons.push('same_feature_key');
    }

    if (profile.team && candidate.team === profile.team) {
      score += 12;
      reasons.push('same_team_or_owner');
    }

    if (profile.primaryMetricKey && candidate.primaryMetricKey === profile.primaryMetricKey) {
      score += 20;
      reasons.push('same_primary_metric');
    }

    if (profile.result && candidate.result === profile.result) {
      score += 6;
      reasons.push('same_result');
    }

    const guardrailOverlap = this.overlapCount(
      profile.guardrailMetricKeys,
      candidate.guardrailMetricKeys,
    );
    if (guardrailOverlap > 0) {
      score += guardrailOverlap * 8;
      reasons.push(`guardrail_overlap:${guardrailOverlap}`);
    }

    const tagsOverlap = this.overlapCount(profile.tags, candidate.tags);
    if (tagsOverlap > 0) {
      score += tagsOverlap * 4;
      reasons.push(`tags_overlap:${tagsOverlap}`);
    }

    const platformsOverlap = this.overlapCount(profile.platforms, candidate.platforms);
    if (platformsOverlap > 0) {
      score += platformsOverlap * 3;
      reasons.push(`platforms_overlap:${platformsOverlap}`);
    }

    const countriesOverlap = this.overlapCount(profile.countries, candidate.countries);
    if (countriesOverlap > 0) {
      score += countriesOverlap * 2;
      reasons.push(`countries_overlap:${countriesOverlap}`);
    }

    return { score, reasons };
  }

  private overlapCount(left: string[], right: string[]): number {
    if (left.length === 0 || right.length === 0) return 0;

    const rightSet = new Set(right);
    return left.filter((value) => rightSet.has(value)).length;
  }

  private normalizeSimilarLimit(raw: number | undefined): number {
    if (!raw || Number.isNaN(raw)) return LearningEntryReadPrismaRepository.DEFAULT_SIMILAR_LIMIT;

    return Math.max(1, Math.min(raw, LearningEntryReadPrismaRepository.MAX_SIMILAR_LIMIT));
  }

  private toOutputWithRevisions(row: LearningEntryWithRevisions): LearningEntryOutput {
    return {
      ...this.toOutput(row),
      revisions: row.revisions.map((revision) => this.toRevisionOutput(revision)),
    };
  }

  private toRevisionOutput(revision: PrismaLearningRevision): LearningRevisionOutput {
    return {
      id: revision.id,
      revision: revision.revision,
      changedById: revision.changedById,
      before: revision.before,
      after: revision.after,
      changedAt: revision.changedAt,
    };
  }

  private toOutput(row: PrismaLearningEntry): LearningEntryOutput {
    return {
      id: row.id,
      experimentId: row.experimentId,
      featureKey: row.featureKey,
      team: row.team,
      title: row.title,
      hypothesis: row.hypothesis,
      primaryMetricKey: row.primaryMetricKey,
      guardrailMetricKeys: row.guardrailMetricKeys,
      result: row.result ? DOMAIN_OUTCOME_BY_PRISMA_OUTCOME[row.result] : null,
      actionTaken: row.actionTaken,
      summary: row.summary,
      notes: row.notes,
      tags: row.tags,
      countries: row.countries,
      platforms: row.platforms,
      reportUrl: row.reportUrl,
      ticketUrl: row.ticketUrl,
      createdById: row.createdById,
      updatedById: row.updatedById,
      isArchived: row.isArchived,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
