import { ExperimentStatus, Prisma, Metric as PrismaMetric } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  Metric,
  MetricId,
  MetricKey,
  MetricKeyAlreadyExistsError,
  MetricRepository,
} from '@/apps/control-api/domain/metric';
import { AppLogger } from '@/shared/application';
import { err, ok, Result, toError } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
  toPrismaJson,
} from '@/shared/infrastructure/persistence';
import { MetricMapper } from './metric.mapper';

@Injectable()
export class MetricPrismaRepository
  extends PrismaRepositoryBase<Metric, PrismaMetric, MetricId, MetricKeyAlreadyExistsError>
  implements MetricRepository
{
  protected readonly entityName = 'Metric';

  constructor(
    txManager: PrismaTransactionManager,
    private readonly appLogger: AppLogger,
    mapper: MetricMapper,
  ) {
    super(txManager, mapper);
  }

  async findById(id: MetricId): Promise<Metric | null> {
    return this.findOne(this.client.metric.findUnique({ where: { id: id.value } }));
  }

  async findByIds(ids: MetricId[]): Promise<Metric[]> {
    if (ids.length === 0) return [];

    const metrics = await this.findMany(
      this.client.metric.findMany({
        where: { id: { in: ids.map((id) => id.value) } },
      }),
    );
    const metricsById = new Map(metrics.map((metric) => [metric.id.value, metric]));
    return ids
      .map((id) => metricsById.get(id.value))
      .filter((metric): metric is Metric => metric !== undefined);
  }

  async findByKey(key: MetricKey): Promise<Metric | null> {
    return this.findOne(this.client.metric.findUnique({ where: { key: key.value } }));
  }

  async findByKeys(keys: MetricKey[]): Promise<Metric[]> {
    if (keys.length === 0) return [];

    return this.findMany(
      this.client.metric.findMany({
        where: { key: { in: keys.map((key) => key.value) } },
      }),
    );
  }

  async isUsedByActiveGuardrails(id: MetricId): Promise<boolean> {
    const count = await this.client.guardrailRule.count({
      where: {
        metricId: id.value,
        experiment: { status: { in: [ExperimentStatus.RUNNING, ExperimentStatus.PAUSED] } },
      },
    });
    return count > 0;
  }

  protected async doCreate(
    entity: Metric,
    version: number,
  ): Promise<Result<void, MetricKeyAlreadyExistsError>> {
    try {
      await this.client.metric.create({
        data: {
          id: entity.id.value,
          key: entity.key.value,
          name: entity.name,
          description: entity.description,
          formula: toPrismaJson(
            entity.formula.toJSON(),
            'Metric.formula must be JSON-serializable',
          ),
          isArchived: entity.isArchived,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt ?? new Date(),
          version,
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new MetricKeyAlreadyExistsError(entity.key));
      }
      throw toError(error);
    }
  }

  protected async doUpdate(
    entity: Metric,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, MetricKeyAlreadyExistsError>> {
    try {
      const updated = await prismaUpdateWithOptimisticLock({
        appLogger: this.appLogger,
        operation: 'MetricPrismaRepository.doUpdate',
        entity: this.entityName,
        entityId: entity.id.value,
        currentVersion,
        newVersion,
        update: async () => {
          await this.client.metric.update({
            where: { id: entity.id.value, version: currentVersion },
            data: {
              name: entity.name,
              description: entity.description,
              formula: toPrismaJson(
                entity.formula.toJSON(),
                'Metric.formula must be JSON-serializable',
              ),
              isArchived: entity.isArchived,
              updatedAt: entity.updatedAt ?? new Date(),
              version: newVersion,
            },
          });
        },
      });
      return ok(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new MetricKeyAlreadyExistsError(entity.key));
      }
      throw toError(error);
    }
  }
}
