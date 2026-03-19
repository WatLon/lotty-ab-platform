import {
  ExperimentOutcomeType as PrismaExperimentOutcomeType,
  LearningEntry as PrismaLearningEntry,
} from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import {
  LearningEntry,
  LearningEntryId,
  LearningEntryRepository,
  LearningEntrySnapshot,
} from '@/apps/control-api/domain/learning';
import { AppLogger } from '@/shared/application';
import { ok, Result } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
  toPrismaJson,
} from '@/shared/infrastructure/persistence';
import { LearningEntryMapper } from './learning-entry.mapper';

const PRISMA_OUTCOME_BY_DOMAIN_OUTCOME: Record<ExperimentOutcomeType, PrismaExperimentOutcomeType> =
  {
    [ExperimentOutcomeType.ROLLOUT_WINNER]: 'ROLLOUT_WINNER',
    [ExperimentOutcomeType.ROLLBACK]: 'ROLLBACK',
    [ExperimentOutcomeType.NO_EFFECT]: 'NO_EFFECT',
  };

@Injectable()
export class LearningEntryPrismaRepository
  extends PrismaRepositoryBase<LearningEntry, PrismaLearningEntry, LearningEntryId>
  implements LearningEntryRepository
{
  protected readonly entityName = 'LearningEntry';

  private readonly snapshots = new WeakMap<LearningEntry, LearningEntrySnapshot>();

  constructor(
    txManager: PrismaTransactionManager,
    mapper: LearningEntryMapper,
    private readonly appLogger: AppLogger,
  ) {
    super(txManager, mapper);
  }

  async findById(id: LearningEntryId): Promise<LearningEntry | null> {
    const entry = await this.findOne(
      this.client.learningEntry.findUnique({ where: { id: id.value } }),
    );
    if (entry) {
      this.snapshots.set(entry, this.cloneSnapshot(entry.toSnapshot()));
    }
    return entry;
  }

  protected async doCreate(entity: LearningEntry, version: number): Promise<Result<void, never>> {
    const snapshot = entity.toSnapshot();

    await this.client.learningEntry.create({
      data: {
        id: entity.id.value,
        experimentId: entity.experimentId,
        featureKey: entity.featureKey,
        team: entity.team,
        title: entity.title,
        hypothesis: entity.hypothesis,
        primaryMetricKey: entity.primaryMetricKey,
        guardrailMetricKeys: entity.guardrailMetricKeys,
        result: entity.result ? PRISMA_OUTCOME_BY_DOMAIN_OUTCOME[entity.result] : null,
        actionTaken: entity.actionTaken,
        summary: entity.summary,
        notes: entity.notes,
        tags: entity.tags,
        countries: entity.countries,
        platforms: entity.platforms,
        reportUrl: entity.reportUrl,
        ticketUrl: entity.ticketUrl,
        createdById: entity.createdById,
        updatedById: entity.updatedById,
        isArchived: entity.isArchived,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? new Date(),
        version,
      },
    });

    await this.client.learningRevision.create({
      data: {
        learningId: entity.id.value,
        revision: 1,
        changedById: entity.createdById,
        before: toPrismaJson({}, 'LearningRevision.before must be JSON-serializable'),
        after: toPrismaJson(snapshot, 'LearningRevision.after must be JSON-serializable'),
      },
    });

    this.snapshots.set(entity, this.cloneSnapshot(snapshot));

    return ok(undefined);
  }

  protected async doUpdate(
    entity: LearningEntry,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, never>> {
    const beforeSnapshot = this.snapshots.get(entity) ?? entity.toSnapshot();
    const afterSnapshot = entity.toSnapshot();

    const updated = await prismaUpdateWithOptimisticLock({
      appLogger: this.appLogger,
      operation: 'LearningEntryPrismaRepository.doUpdate',
      entity: this.entityName,
      entityId: entity.id.value,
      currentVersion,
      newVersion,
      update: async () => {
        await this.client.learningEntry.update({
          where: {
            id: entity.id.value,
            version: currentVersion,
          },
          data: {
            experimentId: entity.experimentId,
            featureKey: entity.featureKey,
            team: entity.team,
            title: entity.title,
            hypothesis: entity.hypothesis,
            primaryMetricKey: entity.primaryMetricKey,
            guardrailMetricKeys: entity.guardrailMetricKeys,
            result: entity.result ? PRISMA_OUTCOME_BY_DOMAIN_OUTCOME[entity.result] : null,
            actionTaken: entity.actionTaken,
            summary: entity.summary,
            notes: entity.notes,
            tags: entity.tags,
            countries: entity.countries,
            platforms: entity.platforms,
            reportUrl: entity.reportUrl,
            ticketUrl: entity.ticketUrl,
            updatedById: entity.updatedById,
            isArchived: entity.isArchived,
            updatedAt: entity.updatedAt ?? new Date(),
            version: newVersion,
          },
        });

        await this.client.learningRevision.create({
          data: {
            learningId: entity.id.value,
            revision: newVersion + 1,
            changedById: entity.updatedById ?? entity.createdById,
            before: toPrismaJson(
              this.cloneSnapshot(beforeSnapshot),
              'LearningRevision.before must be JSON-serializable',
            ),
            after: toPrismaJson(
              this.cloneSnapshot(afterSnapshot),
              'LearningRevision.after must be JSON-serializable',
            ),
          },
        });
      },
    });

    if (updated) {
      this.snapshots.set(entity, this.cloneSnapshot(afterSnapshot));
    }

    return ok(updated);
  }

  private cloneSnapshot(snapshot: LearningEntrySnapshot): LearningEntrySnapshot {
    return {
      ...snapshot,
      guardrailMetricKeys: [...snapshot.guardrailMetricKeys],
      tags: [...snapshot.tags],
      countries: [...snapshot.countries],
      platforms: [...snapshot.platforms],
    };
  }
}
