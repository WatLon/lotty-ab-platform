import {
  ExperimentOutcomeType as PrismaExperimentOutcomeType,
  LearningEntry as PrismaLearningEntry,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import { LearningEntry, LearningEntryId } from '@/apps/control-api/domain/learning';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

const DOMAIN_OUTCOME_BY_PRISMA_OUTCOME: Record<PrismaExperimentOutcomeType, ExperimentOutcomeType> =
  {
    ROLLOUT_WINNER: ExperimentOutcomeType.ROLLOUT_WINNER,
    ROLLBACK: ExperimentOutcomeType.ROLLBACK,
    NO_EFFECT: ExperimentOutcomeType.NO_EFFECT,
  };

@Injectable()
export class LearningEntryMapper implements PersistenceMapper<LearningEntry, PrismaLearningEntry> {
  toDomain(raw: PrismaLearningEntry): LearningEntry {
    return LearningEntry.reconstitute(
      {
        experimentId: raw.experimentId,
        featureKey: raw.featureKey,
        team: raw.team,
        title: raw.title,
        hypothesis: raw.hypothesis,
        primaryMetricKey: raw.primaryMetricKey,
        guardrailMetricKeys: raw.guardrailMetricKeys,
        result: raw.result ? DOMAIN_OUTCOME_BY_PRISMA_OUTCOME[raw.result] : null,
        actionTaken: raw.actionTaken,
        summary: raw.summary,
        notes: raw.notes,
        tags: raw.tags,
        countries: raw.countries,
        platforms: raw.platforms,
        reportUrl: raw.reportUrl,
        ticketUrl: raw.ticketUrl,
        createdById: raw.createdById,
        updatedById: raw.updatedById,
        isArchived: raw.isArchived,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      LearningEntryId.from(raw.id),
    );
  }
}
