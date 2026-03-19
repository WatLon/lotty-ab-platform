import { describe, expect, it } from 'vitest';
import { GuardrailAction } from '@/apps/control-api/domain/guardrail';
import { GuardrailTriggerReadPrismaRepository } from '@/apps/control-api/infrastructure/guardrail/persistence/guardrail-trigger.read-prisma-repository';
import { PrismaService } from '@/shared/infrastructure/persistence';

class PrismaServiceStub {
  findManyResult: unknown[] = [];

  countResult = 0;

  lastFindManyArgs: unknown;

  lastCountArgs: unknown;

  readonly guardrailTrigger = {
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

function rawTrigger(id: string, actionTaken: 'PAUSE' | 'ROLLBACK' = 'PAUSE') {
  return {
    id,
    guardrailId: `guardrail_${id}`,
    experimentId: 'exp-1',
    metricValue: 12.5,
    threshold: 10,
    actionTaken,
    triggeredAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('GuardrailTriggerReadPrismaRepository', () => {
  it('maps rows and returns paginated result', async () => {
    const prisma = new PrismaServiceStub();
    prisma.findManyResult = [rawTrigger('t-1', 'PAUSE')];
    prisma.countResult = 1;
    const repository = new GuardrailTriggerReadPrismaRepository(prisma as unknown as PrismaService);

    const result = await repository.findByExperiment('exp-1', {});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 't-1',
      guardrailId: 'guardrail_t-1',
      metricValue: 12.5,
      threshold: 10,
      actionTaken: GuardrailAction.PAUSE,
    });
    expect(prisma.lastFindManyArgs).toMatchObject({
      where: { experimentId: 'exp-1' },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
      skip: 0,
    });
    expect(prisma.lastCountArgs).toMatchObject({ where: { experimentId: 'exp-1' } });
  });

  it('applies filters and normalizes pagination bounds', async () => {
    const prisma = new PrismaServiceStub();
    const repository = new GuardrailTriggerReadPrismaRepository(prisma as unknown as PrismaService);

    await repository.findByExperiment(
      'exp-1',
      { limit: -10, offset: -3 },
      { guardrailId: 'guardrail-1', actionTaken: GuardrailAction.ROLLBACK },
    );

    expect(prisma.lastFindManyArgs).toMatchObject({
      where: {
        experimentId: 'exp-1',
        guardrailId: 'guardrail-1',
        actionTaken: 'ROLLBACK',
      },
      take: 1,
      skip: 0,
    });
    expect(prisma.lastCountArgs).toMatchObject({
      where: {
        experimentId: 'exp-1',
        guardrailId: 'guardrail-1',
        actionTaken: 'ROLLBACK',
      },
    });
  });
});
