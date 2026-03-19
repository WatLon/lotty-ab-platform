import { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment/enums/experiment-status.enum';
import { ExperimentAlreadyExistsForFlagError } from '@/apps/control-api/domain/experiment/errors/experiment-already-exists-for-flag.error';
import { Experiment } from '@/apps/control-api/domain/experiment/experiment.aggregate-root';
import { ExperimentRepository } from '@/apps/control-api/domain/experiment/experiment.repository';
import { ExperimentId } from '@/apps/control-api/domain/experiment/value-objects/experiment.id';
import { FlagId } from '@/apps/control-api/domain/flag';
import { AppLogger } from '@/shared/application';
import { ConcurrencyError, err, ok, Result, toError } from '@/shared/domain/common';
import { PrismaTransactionManager, toPrismaJson } from '@/shared/infrastructure/persistence';
import { ExperimentEventSerializer, StoredEvent } from './experiment.event-serializer';

const ACTIVE_STATUSES = [ExperimentStatus.RUNNING, ExperimentStatus.PAUSED] as const;
const OPEN_EXPERIMENT_CONSTRAINT = 'uq_experiments_open_per_flag';

@Injectable()
export class ExperimentEventStoreRepository implements ExperimentRepository {
  private readonly versions = new WeakMap<Experiment, number>();

  constructor(
    private readonly txManager: PrismaTransactionManager,
    private readonly logger: AppLogger,
    private readonly serializer: ExperimentEventSerializer,
  ) {}

  private get db() {
    return this.txManager.getClient();
  }

  async findById(id: ExperimentId): Promise<Experiment | null> {
    const rows = await this.db.experimentEvent.findMany({
      where: { aggregateId: id.value },
      orderBy: { version: 'asc' },
    });
    return this.reconstitute(id, rows);
  }

  async findActiveByFlagId(flagId: FlagId): Promise<Experiment | null> {
    const active = await this.db.experiment.findMany({
      where: { flagId: flagId.value, status: { in: [...ACTIVE_STATUSES] } },
      select: { id: true, status: true, priority: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 2,
    });
    if (active.length === 0) return null;

    if (active.length > 1) {
      this.logger.error(
        {
          event: 'experiment.repository.invariant_violated',
          domain: 'infrastructure',
          operation: 'findActiveByFlagId',
          status: 'failure',
          meta: {
            flagId: flagId.value,
            activeCount: active.length,
            activeExperiments: active.map((r) => ({
              id: r.id,
              status: r.status,
              priority: r.priority,
              updatedAt: r.updatedAt.toISOString(),
            })),
          },
        },
        undefined,
        'multiple active experiments detected for one flag',
      );
      return null;
    }
    return this.findById(ExperimentId.from(active[0].id));
  }

  async findByFlagIdAndStatuses(
    flagId: FlagId,
    statuses: ExperimentStatus[],
  ): Promise<Experiment[]> {
    const aggregates = await this.db.experiment.findMany({
      where: { flagId: flagId.value, status: { in: statuses } },
      select: { id: true },
    });
    if (aggregates.length === 0) return [];

    const ids = aggregates.map((r) => r.id);
    const allRows = await this.db.experimentEvent.findMany({
      where: { aggregateId: { in: ids } },
      orderBy: [{ aggregateId: 'asc' }, { version: 'asc' }],
    });
    const grouped = new Map<string, StoredEvent[]>();
    for (const row of allRows) {
      let list = grouped.get(row.aggregateId);
      if (!list) {
        list = [];
        grouped.set(row.aggregateId, list);
      }
      list.push(row);
    }
    const experiments: Experiment[] = [];
    for (const id of ids) {
      const exp = this.reconstitute(ExperimentId.from(id), grouped.get(id) ?? []);
      if (exp) experiments.push(exp);
    }

    return experiments;
  }

  async save(
    entity: Experiment,
  ): Promise<Result<void, ConcurrencyError | ExperimentAlreadyExistsForFlagError>> {
    const uncommitted = entity.uncommittedEvents;
    const version = this.versions.get(entity) ?? 0;

    try {
      if (uncommitted.length > 0) {
        const serialized = uncommitted.map((evt, i) =>
          this.serializer.serialize(evt, entity.id.value, version + i + 1),
        );
        await this.db.experimentEvent.createMany({
          data: serialized.map((e) => ({
            aggregateId: e.aggregateId,
            version: e.version,
            eventType: e.eventType,
            payload: toPrismaJson(e.payload, 'Event payload not serializable'),
            occurredAt: e.occurredAt,
          })),
        });
        await this.txManager.stageDomainEvents(uncommitted);
      }

      await this.syncReadModel(entity);
      if (uncommitted.length > 0) {
        this.versions.set(entity, version + uncommitted.length);
        entity.clearUncommittedEvents();
      }

      return ok(undefined);
    } catch (error) {
      return this.handleSaveError(error, entity, version);
    }
  }

  async delete(id: ExperimentId): Promise<void> {
    const byExperiment = { where: { experimentId: id.value } };
    await this.db.experimentMetric.deleteMany(byExperiment);
    await this.db.experimentEvent.deleteMany({ where: { aggregateId: id.value } });
    await this.db.review.deleteMany(byExperiment);
    await this.db.experimentOutcome.deleteMany(byExperiment);
    await this.db.variant.deleteMany(byExperiment);
    await this.db.experiment.deleteMany({ where: { id: id.value } });
  }

  private async syncReadModel(entity: Experiment): Promise<void> {
    const id = entity.id.value;
    const data = {
      name: entity.name.value,
      description: entity.description,
      flagId: entity.flagId.value,
      status: entity.status,
      conflictDomain: entity.conflictDomain,
      priority: entity.priority,
      audiencePercent: entity.audiencePercent.value,
      targetingRule: toPrismaJson(entity.targetingRule.toJSON(), 'targetingRule not serializable'),
      ownerId: entity.ownerId.value,
      startedAt: entity.startedAt,
      pausedAt: entity.pausedAt,
      completedAt: entity.completedAt,
    };
    await this.db.experiment.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    await this.db.variant.deleteMany({ where: { experimentId: id } });
    if (entity.variants.length > 0) {
      await this.db.variant.createMany({
        data: entity.variants.map((v) => ({
          id: v.id.value,
          experimentId: id,
          name: v.name.value,
          value: v.value.value,
          weight: v.weight.value,
          isControl: v.isControl,
        })),
      });
    }

    await this.db.review.deleteMany({ where: { experimentId: id } });
    if (entity.reviews.length > 0) {
      await this.db.review.createMany({
        data: entity.reviews.map((r) => ({
          id: r.id,
          experimentId: id,
          reviewerId: r.reviewerId,
          decision: r.decision,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
      });
    }

    await this.db.experimentMetric.deleteMany({ where: { experimentId: id } });
    if (entity.metricIds.length > 0) {
      await this.db.experimentMetric.createMany({
        data: entity.metricIds.map((metricId) => ({
          experimentId: id,
          metricId,
          isPrimary: metricId === entity.primaryMetricId,
        })),
      });
    }

    await this.db.experimentOutcome.deleteMany({ where: { experimentId: id } });
    if (entity.outcome) {
      await this.db.experimentOutcome.create({
        data: {
          experimentId: id,
          outcome: entity.outcome.type,
          winnerVariantId: entity.outcome.winnerVariantId?.value ?? null,
          comment: entity.outcome.comment,
          decidedById: entity.outcome.decidedById.value,
          decidedAt: entity.outcome.decidedAt,
        },
      });
    }
  }

  private reconstitute(id: ExperimentId, rows: StoredEvent[]): Experiment | null {
    if (rows.length === 0) return null;

    const events = rows.map((row) => this.serializer.deserialize(row));
    const experiment = Experiment.reconstitute(id, events);
    this.versions.set(experiment, rows.length);
    return experiment;
  }

  private handleSaveError(
    error: unknown,
    entity: Experiment,
    version: number,
  ): Result<void, ConcurrencyError | ExperimentAlreadyExistsForFlagError> {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? error.message);
      if (target.includes(OPEN_EXPERIMENT_CONSTRAINT)) {
        return err(new ExperimentAlreadyExistsForFlagError(entity.flagId));
      }

      return err(new ConcurrencyError('Experiment', entity.id));
    }

    this.logger.error(
      {
        event: 'infrastructure.db.operation.failed',
        domain: 'infrastructure',
        operation: 'ExperimentEventStoreRepository.save',
        status: 'failure',
        meta: { entity: 'Experiment', entityId: entity.id.value, version },
      },
      error,
      'experiment event store save failed',
    );
    throw toError(error);
  }
}
