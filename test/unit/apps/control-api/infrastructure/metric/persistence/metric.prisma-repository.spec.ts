import { describe, expect, it } from 'vitest';
import {
  Metric,
  MetricId,
  MetricKey,
  MetricKeyAlreadyExistsError,
} from '@/apps/control-api/domain/metric';
import { MetricPrismaRepository } from '@/apps/control-api/infrastructure/metric/persistence/metric.prisma-repository';
import { PrismaTransactionManager } from '@/shared/infrastructure/persistence/prisma-transaction-manager';
import {
  callDoUpdate,
  createAppLoggerSpy,
  createKnownRequestError,
} from '../../../../../../support/prisma-repo-testkit';

type DomainMetricLike = Metric & {
  id: MetricId;
};
function createMetricEntity(idValue = '00000000-0000-0000-0000-000000000101'): Metric {
  return {
    id: MetricId.from(idValue),
    key: MetricKey.reconstitute('ctr'),
    name: 'CTR',
    description: 'desc',
    formula: {
      toJSON: () => ({ type: 'COUNT', eventTypeKey: 'event.clicked' }),
    },
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    domainEvents: [],
    clearEvents: () => undefined,
  } as unknown as Metric;
}
function createRepository(client: unknown) {
  const txManager = {
    getClient: () => client,
  } as unknown as PrismaTransactionManager;
  const { appLogger, calls } = createAppLoggerSpy();
  const mapper = {
    toDomain: (raw: { id: string }) => ({
      id: MetricId.from(raw.id),
    }),
  };
  const repository = new MetricPrismaRepository(txManager, appLogger, mapper as never);
  return { repository, calls };
}
describe('MetricPrismaRepository', () => {
  it('returns empty arrays when ids/keys inputs are empty', async () => {
    const client = {
      metric: {
        findUnique: async () => null,
        findMany: async () => {
          throw new Error('should not be called');
        },
      },
      guardrailRule: {
        count: async () => 0,
      },
    };
    const { repository } = createRepository(client);
    const byIds = await repository.findByIds([]);
    const byKeys = await repository.findByKeys([]);
    expect(byIds).toEqual([]);
    expect(byKeys).toEqual([]);
  });
  it('maps findById/findByKey/findByIds/findByKeys and preserves ID input order', async () => {
    const client = {
      metric: {
        findUnique: async ({
          where,
        }: {
          where: {
            id?: string;
            key?: string;
          };
        }) => {
          if (where.id === '00000000-0000-0000-0000-000000000201') {
            return { id: where.id, version: 1 };
          }
          if (where.key === 'ctr') {
            return { id: '00000000-0000-0000-0000-000000000202', version: 1 };
          }
          return null;
        },
        findMany: async ({
          where,
        }: {
          where: {
            id?: {
              in: string[];
            };
            key?: {
              in: string[];
            };
          };
        }) => {
          if (where.id) {
            return [
              { id: '00000000-0000-0000-0000-000000000203', version: 1 },
              { id: '00000000-0000-0000-0000-000000000201', version: 1 },
            ];
          }
          return [{ id: '00000000-0000-0000-0000-000000000204', version: 1 }];
        },
      },
      guardrailRule: {
        count: async () => 0,
      },
    };
    const { repository } = createRepository(client);
    const byId = await repository.findById(MetricId.from('00000000-0000-0000-0000-000000000201'));
    expect((byId as DomainMetricLike | null)?.id.value).toBe(
      '00000000-0000-0000-0000-000000000201',
    );
    const byKey = await repository.findByKey(MetricKey.reconstitute('ctr'));
    expect((byKey as DomainMetricLike | null)?.id.value).toBe(
      '00000000-0000-0000-0000-000000000202',
    );
    const byIds = await repository.findByIds([
      MetricId.from('00000000-0000-0000-0000-000000000201'),
      MetricId.from('00000000-0000-0000-0000-000000000299'),
      MetricId.from('00000000-0000-0000-0000-000000000203'),
    ]);
    expect(byIds.map((m) => (m as DomainMetricLike).id.value)).toEqual([
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000203',
    ]);
    const byKeys = await repository.findByKeys([
      MetricKey.reconstitute('ctr'),
      MetricKey.reconstitute('error_rate'),
    ]);
    expect(byKeys.map((m) => (m as DomainMetricLike).id.value)).toEqual([
      '00000000-0000-0000-0000-000000000204',
    ]);
  });
  it('reports whether metric is used by active guardrails', async () => {
    const client = {
      metric: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      guardrailRule: {
        count: async () => 2,
      },
    };
    const { repository } = createRepository(client);
    expect(
      await repository.isUsedByActiveGuardrails(
        MetricId.from('00000000-0000-0000-0000-000000000301'),
      ),
    ).toBe(true);
    client.guardrailRule.count = async () => 0;
    expect(
      await repository.isUsedByActiveGuardrails(
        MetricId.from('00000000-0000-0000-0000-000000000301'),
      ),
    ).toBe(false);
  });
  it('doCreate maps P2002 to MetricKeyAlreadyExistsError', async () => {
    const client = {
      metric: {
        create: async () => {
          throw createKnownRequestError('P2002');
        },
        update: async () => undefined,
      },
      guardrailRule: {
        count: async () => 0,
      },
    };
    const { repository } = createRepository(client);
    const result = await (
      repository as unknown as {
        doCreate: (
          entity: Metric,
          version: number,
        ) => Promise<{
          isErr(): boolean;
          error?: unknown;
        }>;
      }
    ).doCreate(createMetricEntity(), 1);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(MetricKeyAlreadyExistsError);
    }
  });
  it('doCreate rethrows unknown failures', async () => {
    const failure = new Error('db down');
    const client = {
      metric: {
        create: async () => {
          throw failure;
        },
        update: async () => undefined,
      },
      guardrailRule: {
        count: async () => 0,
      },
    };
    const { repository } = createRepository(client);
    await expect(
      (
        repository as unknown as {
          doCreate: (entity: Metric, version: number) => Promise<void>;
        }
      ).doCreate(createMetricEntity(), 1),
    ).rejects.toThrow('db down');
  });
  it('doUpdate returns false on P2025 and logs/rethrows unknown errors', async () => {
    const client = {
      metric: {
        update: async () => {
          throw createKnownRequestError('P2025');
        },
        create: async () => undefined,
      },
      guardrailRule: {
        count: async () => 0,
      },
    };
    const { repository, calls } = createRepository(client);
    const p2025 = await callDoUpdate(
      repository,
      createMetricEntity('00000000-0000-0000-0000-000000000401'),
      1,
      2,
    );
    expect(p2025).toBe(false);
    expect(calls).toHaveLength(0);
    const failure = new Error('db down');
    client.metric.update = async () => {
      throw failure;
    };
    await expect(
      callDoUpdate(repository, createMetricEntity('00000000-0000-0000-0000-000000000402'), 3, 4),
    ).rejects.toThrow('db down');
    expect(calls).toHaveLength(1);
    expect(calls[0][0].operation).toBe('MetricPrismaRepository.doUpdate');
  });
});
