import { describe, expect, it } from 'vitest';
import {
  EventType,
  EventTypeId,
  EventTypeKey,
  EventTypeKeyAlreadyExistsError,
} from '@/apps/control-api/domain/event-type';
import { EventTypePrismaRepository } from '@/apps/control-api/infrastructure/event-type/persistence/event-type.prisma-repository';
import { PrismaTransactionManager } from '@/shared/infrastructure/persistence/prisma-transaction-manager';
import {
  callDoUpdate,
  createAppLoggerSpy,
  createKnownRequestError,
} from '../../../../../../support/prisma-repo-testkit';

type DomainEventTypeLike = EventType & {
  id: EventTypeId;
};
function createEventTypeEntity(idValue = '00000000-0000-0000-0000-000000000501'): EventType {
  return {
    id: EventTypeId.from(idValue),
    key: EventTypeKey.reconstitute('button.clicked'),
    name: 'Button clicked',
    description: null,
    schema: { type: 'object' },
    requiresExposure: true,
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    domainEvents: [],
    clearEvents: () => undefined,
  } as unknown as EventType;
}
function createRepository(client: unknown) {
  const txManager = {
    getClient: () => client,
  } as unknown as PrismaTransactionManager;
  const { appLogger, calls } = createAppLoggerSpy();
  const mapper = {
    toDomain: (raw: { id: string }) => ({
      id: EventTypeId.from(raw.id),
    }),
  };
  const repository = new EventTypePrismaRepository(txManager, appLogger, mapper as never);
  return { repository, calls };
}
describe('EventTypePrismaRepository', () => {
  it('findByKeys returns empty for empty input and maps non-empty input', async () => {
    const client = {
      eventType: {
        findUnique: async ({
          where,
        }: {
          where: {
            id?: string;
            key?: string;
          };
        }) => {
          if (where.id === '00000000-0000-0000-0000-000000000511') {
            return { id: where.id, version: 1 };
          }
          if (where.key === 'button.clicked') {
            return { id: '00000000-0000-0000-0000-000000000512', version: 1 };
          }
          return null;
        },
        findMany: async ({
          where,
        }: {
          where: {
            key: {
              in: string[];
            };
          };
        }) => {
          if (where.key.in.length === 0) {
            throw new Error('should not be called for empty input');
          }
          return [{ id: '00000000-0000-0000-0000-000000000513', version: 1 }];
        },
      },
    };
    const { repository } = createRepository(client);
    expect(await repository.findByKeys([])).toEqual([]);
    const byId = await repository.findById(
      EventTypeId.from('00000000-0000-0000-0000-000000000511'),
    );
    expect((byId as DomainEventTypeLike | null)?.id.value).toBe(
      '00000000-0000-0000-0000-000000000511',
    );
    const byKey = await repository.findByKey(EventTypeKey.reconstitute('button.clicked'));
    expect((byKey as DomainEventTypeLike | null)?.id.value).toBe(
      '00000000-0000-0000-0000-000000000512',
    );
    const byKeys = await repository.findByKeys([
      EventTypeKey.reconstitute('button.clicked'),
      EventTypeKey.reconstitute('button.shown'),
    ]);
    expect(byKeys.map((entity) => (entity as DomainEventTypeLike).id.value)).toEqual([
      '00000000-0000-0000-0000-000000000513',
    ]);
  });
  it('doCreate maps P2002 to EventTypeKeyAlreadyExistsError', async () => {
    const client = {
      eventType: {
        create: async () => {
          throw createKnownRequestError('P2002');
        },
        update: async () => undefined,
      },
    };
    const { repository } = createRepository(client);
    const result = await (
      repository as unknown as {
        doCreate: (
          entity: EventType,
          version: number,
        ) => Promise<{
          isErr(): boolean;
          error?: unknown;
        }>;
      }
    ).doCreate(createEventTypeEntity(), 1);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(EventTypeKeyAlreadyExistsError);
    }
  });
  it('doCreate rethrows unknown failures', async () => {
    const failure = new Error('db down');
    const client = {
      eventType: {
        create: async () => {
          throw failure;
        },
        update: async () => undefined,
      },
    };
    const { repository } = createRepository(client);
    await expect(
      (
        repository as unknown as {
          doCreate: (entity: EventType, version: number) => Promise<void>;
        }
      ).doCreate(createEventTypeEntity(), 1),
    ).rejects.toThrow('db down');
  });
  it('doUpdate returns false on P2025 and logs/rethrows unknown errors', async () => {
    const client = {
      eventType: {
        update: async () => {
          throw createKnownRequestError('P2025');
        },
        create: async () => undefined,
      },
    };
    const { repository, calls } = createRepository(client);
    const p2025 = await callDoUpdate(repository, createEventTypeEntity(), 1, 2);
    expect(p2025).toBe(false);
    expect(calls).toHaveLength(0);
    const failure = new Error('db down');
    client.eventType.update = async () => {
      throw failure;
    };
    await expect(callDoUpdate(repository, createEventTypeEntity(), 3, 4)).rejects.toThrow(
      'db down',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][0].operation).toBe('EventTypePrismaRepository.doUpdate');
  });
});
