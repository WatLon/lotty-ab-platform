import { describe, expect, it } from 'vitest';
import { MetricReadPrismaRepository } from '@/apps/control-api/infrastructure/metric/persistence/metric.read-prisma-repository';
import { PrismaService } from '@/shared/infrastructure/persistence';

class PrismaServiceStub {
  findUniqueResult: unknown = null;

  findManyResult: unknown[] = [];

  countResult = 0;

  lastFindManyArgs: unknown;

  lastCountArgs: unknown;

  readonly metric = {
    findUnique: async () => this.findUniqueResult,
    findMany: async (args: unknown) => {
      this.lastFindManyArgs = args;
      return this.findManyResult;
    },
    count: async (args: unknown) => {
      this.lastCountArgs = args;
      return this.countResult;
    },
  };
}

function rawMetric(id: string, isArchived = false) {
  return {
    id,
    key: `metric_${id}`,
    name: `Metric ${id}`,
    description: null,
    formula: { type: 'COUNT', eventTypeKey: 'event.clicked' },
    isArchived,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
  };
}

describe('MetricReadPrismaRepository', () => {
  it('returns null for missing metric and maps found metric', async () => {
    const prisma = new PrismaServiceStub();
    const repository = new MetricReadPrismaRepository(prisma as unknown as PrismaService);

    expect(await repository.findById('m-1')).toBeNull();

    prisma.findUniqueResult = rawMetric('m-1');
    const found = await repository.findById('m-1');
    expect(found?.id).toBe('m-1');
    expect(found?.formula).toEqual({ type: 'COUNT', eventTypeKey: 'event.clicked' });
  });

  it('returns empty array for findByIds([]) and preserves input ID order otherwise', async () => {
    const prisma = new PrismaServiceStub();
    const repository = new MetricReadPrismaRepository(prisma as unknown as PrismaService);

    expect(await repository.findByIds([])).toEqual([]);

    prisma.findManyResult = [rawMetric('m-2'), rawMetric('m-1')];
    const ordered = await repository.findByIds(['m-1', 'm-3', 'm-2']);
    expect(ordered.map((metric) => metric.id)).toEqual(['m-1', 'm-2']);
  });

  it('findAll applies default archive filter and normalized pagination', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findManyResult = [rawMetric('m-1')];
    prisma.countResult = 1;
    const repository = new MetricReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findAll({ limit: -5, offset: -1 });

    expect(result.limit).toBe(1);
    expect(result.offset).toBe(0);
    expect(prisma.lastFindManyArgs).toMatchObject({
      where: { isArchived: false },
      take: 1,
      skip: 0,
    });
    expect(prisma.lastCountArgs).toMatchObject({ where: { isArchived: false } });
  });

  it('findAll includes archived metrics when option is enabled', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findManyResult = [rawMetric('m-archived', true)];
    prisma.countResult = 1;
    const repository = new MetricReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findAll({ limit: 5, offset: 2 }, { includeArchived: true });

    expect(result.data[0]?.isArchived).toBe(true);
    expect(prisma.lastFindManyArgs).toMatchObject({ where: {}, take: 5, skip: 2 });
    expect(prisma.lastCountArgs).toMatchObject({ where: {} });
  });
});
