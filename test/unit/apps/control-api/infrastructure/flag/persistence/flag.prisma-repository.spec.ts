import { Flag } from '@/apps/control-api/domain/flag/flag.aggregate-root';
import { FlagValueType } from '@/apps/control-api/domain/flag/flag-value-type.enum';
import { FlagDefaultValue } from '@/apps/control-api/domain/flag/value-objects/flag-default-value.vo';
import { FlagKey } from '@/apps/control-api/domain/flag/value-objects/flag-key.vo';
import { FlagMapper } from '@/apps/control-api/infrastructure/flag/persistence/flag.mapper';
import { FlagPrismaRepository } from '@/apps/control-api/infrastructure/flag/persistence/flag.prisma-repository';
import { PrismaTransactionManager } from '@/shared/infrastructure/persistence/prisma-transaction-manager';
import {
  callDoUpdate,
  createAppLoggerSpy,
  createKnownRequestError,
  unwrap,
} from '../../../../../../support/prisma-repo-testkit';

function createFlagEntity(): Flag {
  return unwrap(
    Flag.create({
      key: FlagKey.reconstitute('feature_toggle'),
      valueType: FlagValueType.STRING,
      defaultValue: FlagDefaultValue.reconstitute('A'),
      description: 'test flag',
    }),
  );
}

describe('FlagPrismaRepository.doUpdate', () => {
  it('returns false on Prisma P2025 error', async () => {
    const client = {
      flag: {
        update: async () => {
          throw createKnownRequestError('P2025');
        },
      },
    };
    const txManager = {
      getClient: () => client,
    } as unknown as PrismaTransactionManager;
    const { appLogger, calls } = createAppLoggerSpy();
    const repository = new FlagPrismaRepository(txManager, appLogger, new FlagMapper());

    const result = await callDoUpdate(repository, createFlagEntity(), 1, 2);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('logs and rethrows unknown errors', async () => {
    const failure = new Error('db down');
    const client = {
      flag: {
        update: async () => {
          throw failure;
        },
      },
    };
    const txManager = {
      getClient: () => client,
    } as unknown as PrismaTransactionManager;
    const { appLogger, calls } = createAppLoggerSpy();
    const repository = new FlagPrismaRepository(txManager, appLogger, new FlagMapper());

    await expect(callDoUpdate(repository, createFlagEntity(), 3, 4)).rejects.toThrow('db down');

    expect(calls).toHaveLength(1);
    expect(calls[0][0].operation).toBe('FlagPrismaRepository.doUpdate');
    expect(calls[0][0].meta).toMatchObject({
      entity: 'Flag',
      currentVersion: 3,
      newVersion: 4,
    });
    expect(calls[0][1]).toBe(failure);
    expect(calls[0][2]).toBe('database update failed');
  });
});
