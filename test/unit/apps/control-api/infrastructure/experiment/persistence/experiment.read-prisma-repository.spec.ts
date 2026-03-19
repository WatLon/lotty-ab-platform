import { describe, expect, it } from 'vitest';
import {
  ExperimentOutcomeType,
  ExperimentStatus,
  ReviewDecision,
} from '@/apps/control-api/domain/experiment';
import { ExperimentReadPrismaRepository } from '@/apps/control-api/infrastructure/experiment/persistence/experiment.read-prisma-repository';
import { PrismaService } from '@/shared/infrastructure/persistence';

class PrismaServiceStub {
  findUniqueResult: unknown = null;

  findManyResult: unknown[] = [];

  countResult = 0;

  lastFindUniqueArgs: unknown;

  lastFindManyArgs: unknown;

  lastCountArgs: unknown;

  readonly experiment = {
    findUnique: async (args: unknown) => {
      this.lastFindUniqueArgs = args;
      return this.findUniqueResult;
    },
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

function buildRawExperiment(overrides?: {
  status?: string;
  withOutcome?: boolean;
  primaryMetricId?: string | null;
}) {
  const primaryMetricId =
    overrides && 'primaryMetricId' in overrides ? overrides.primaryMetricId : 'metric-1';

  return {
    id: 'exp-1',
    name: 'Experiment',
    description: 'desc',
    flagId: 'flag-1',
    status: overrides?.status ?? 'RUNNING',
    conflictDomain: 'checkout',
    priority: 10,
    audiencePercent: 70,
    targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
    ownerId: 'owner-1',
    variants: [
      {
        id: 'variant-1',
        name: 'A',
        value: 'blue',
        weight: 35,
        isControl: true,
      },
      {
        id: 'variant-2',
        name: 'B',
        value: 'red',
        weight: 35,
        isControl: false,
      },
    ],
    metrics: [
      { metricId: 'metric-1', isPrimary: primaryMetricId === 'metric-1' },
      { metricId: 'metric-2', isPrimary: primaryMetricId === 'metric-2' },
    ],
    outcome: overrides?.withOutcome
      ? {
          outcome: 'NO_EFFECT',
          winnerVariantId: null,
          comment: 'no effect',
          decidedById: 'owner-1',
          decidedAt: new Date('2026-02-01T00:00:00.000Z'),
        }
      : null,
    reviews: [
      {
        id: 'review-1',
        reviewerId: 'reviewer-1',
        decision: 'CHANGES_REQUESTED',
        comment: 'fix metrics',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        id: 'review-2',
        reviewerId: 'reviewer-2',
        decision: 'APPROVED',
        comment: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ],
    startedAt: new Date('2026-01-04T00:00:00.000Z'),
    pausedAt: null,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-05T00:00:00.000Z'),
  };
}

describe('ExperimentReadPrismaRepository', () => {
  it('returns null when experiment is not found', async () => {
    const prisma = new PrismaServiceStub();
    const repository = new ExperimentReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findById('exp-1');

    expect(result).toBeNull();
  });

  it('maps findById result to output shape with enum conversions', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findUniqueResult = buildRawExperiment({ withOutcome: true });
    const repository = new ExperimentReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findById('exp-1');

    expect(result).not.toBeNull();
    expect(result?.status).toBe(ExperimentStatus.RUNNING);
    expect(result?.metricIds).toEqual(['metric-1', 'metric-2']);
    expect(result?.primaryMetricId).toBe('metric-1');
    expect(result?.outcome?.type).toBe(ExperimentOutcomeType.NO_EFFECT);
    expect(result?.reviews.map((review) => review.decision)).toEqual([
      ReviewDecision.CHANGES_REQUESTED,
      ReviewDecision.APPROVED,
    ]);
  });

  it('maps null outcome and null primary metric', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findUniqueResult = buildRawExperiment({
      status: 'PAUSED',
      withOutcome: false,
      primaryMetricId: null,
    });
    const repository = new ExperimentReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findById('exp-1');

    expect(result?.status).toBe(ExperimentStatus.PAUSED);
    expect(result?.outcome).toBeNull();
    expect(result?.primaryMetricId).toBeNull();
  });

  it('applies filters and normalized pagination in findAll', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findManyResult = [buildRawExperiment({ withOutcome: true })];
    prisma.countResult = 11;
    const repository = new ExperimentReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findAll({
      flagId: 'flag-1',
      status: ExperimentStatus.APPROVED,
      ownerId: 'owner-1',
      limit: -2,
      offset: -9,
    });

    expect(result.total).toBe(11);
    expect(result.limit).toBe(1);
    expect(result.offset).toBe(0);
    expect(result.data).toHaveLength(1);

    expect(prisma.lastFindManyArgs).toMatchObject({
      where: {
        flagId: 'flag-1',
        status: 'APPROVED',
        ownerId: 'owner-1',
      },
      take: 1,
      skip: 0,
    });
    expect(prisma.lastCountArgs).toMatchObject({
      where: {
        flagId: 'flag-1',
        status: 'APPROVED',
        ownerId: 'owner-1',
      },
    });
  });

  it('uses default pagination when params are omitted', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findManyResult = [];
    prisma.countResult = 0;
    const repository = new ExperimentReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findAll({});

    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(prisma.lastFindManyArgs).toMatchObject({
      where: {},
      take: 50,
      skip: 0,
    });
  });
});
