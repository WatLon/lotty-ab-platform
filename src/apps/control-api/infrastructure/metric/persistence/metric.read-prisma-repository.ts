import { Metric as PrismaMetric } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  MetricOutput,
  MetricReadOptions,
  MetricReadRepository,
} from '@/apps/control-api/application/metric';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

@Injectable()
export class MetricReadPrismaRepository implements MetricReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<MetricOutput | null> {
    const raw = await this.prisma.metric.findUnique({ where: { id } });
    if (!raw) return null;

    return this.toOutput(raw);
  }

  async findByIds(ids: string[]): Promise<MetricOutput[]> {
    if (ids.length === 0) return [];

    const raws = await this.prisma.metric.findMany({
      where: { id: { in: ids } },
    });

    const outputsById = new Map(raws.map((raw) => [raw.id, this.toOutput(raw)]));
    return ids
      .map((id) => outputsById.get(id))
      .filter((metric): metric is MetricOutput => !!metric);
  }

  async findAll(
    params: PaginationParams,
    options?: MetricReadOptions,
  ): Promise<PaginatedResult<MetricOutput>> {
    const { limit, offset } = normalizePagination(params);
    const includeArchived = options?.includeArchived ?? false;
    const where = includeArchived ? {} : { isArchived: false };

    const [metrics, total] = await Promise.all([
      this.prisma.metric.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.metric.count({ where }),
    ]);

    return {
      data: metrics.map((metric) => this.toOutput(metric)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(raw: PrismaMetric): MetricOutput {
    return {
      id: raw.id,
      key: raw.key,
      name: raw.name,
      description: raw.description,
      formula: raw.formula,
      isArchived: raw.isArchived,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
