import { Role } from '@/apps/control-api/domain/user/role.enum';
import { User } from '@/apps/control-api/domain/user/user.aggregate-root';
import { UserEmail } from '@/apps/control-api/domain/user/value-objects/user-email.vo';
import { UserName } from '@/apps/control-api/domain/user/value-objects/user-name.vo';
import { UserPassword } from '@/apps/control-api/domain/user/value-objects/user-password.vo';
import { UserMapper } from '@/apps/control-api/infrastructure/user/persistence/user.mapper';
import { UserPrismaRepository } from '@/apps/control-api/infrastructure/user/persistence/user.prisma-repository';
import { PrismaTransactionManager } from '@/shared/infrastructure/persistence/prisma-transaction-manager';
import {
  callDoUpdate,
  createAppLoggerSpy,
  createKnownRequestError,
  unwrap,
} from '../../../../../../support/prisma-repo-testkit';

function createUserEntity(): User {
  return unwrap(
    User.create({
      email: UserEmail.reconstitute('user@example.com'),
      password: UserPassword.reconstitute('hashed-password'),
      name: UserName.reconstitute('User'),
      role: Role.VIEWER,
    }),
  );
}

describe('UserPrismaRepository.doUpdate', () => {
  it('returns false on Prisma P2025 error', async () => {
    const client = {
      user: {
        update: async () => {
          throw createKnownRequestError('P2025');
        },
      },
    };
    const txManager = {
      getClient: () => client,
    } as unknown as PrismaTransactionManager;
    const { appLogger, calls } = createAppLoggerSpy();
    const repository = new UserPrismaRepository(txManager, appLogger, new UserMapper());

    const result = await callDoUpdate(repository, createUserEntity(), 1, 2);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('logs and rethrows unknown errors', async () => {
    const failure = new Error('db down');
    const client = {
      user: {
        update: async () => {
          throw failure;
        },
      },
    };
    const txManager = {
      getClient: () => client,
    } as unknown as PrismaTransactionManager;
    const { appLogger, calls } = createAppLoggerSpy();
    const repository = new UserPrismaRepository(txManager, appLogger, new UserMapper());

    await expect(callDoUpdate(repository, createUserEntity(), 3, 4)).rejects.toThrow('db down');

    expect(calls).toHaveLength(1);
    expect(calls[0][0].operation).toBe('UserPrismaRepository.doUpdate');
    expect(calls[0][0].meta).toMatchObject({
      entity: 'User',
      currentVersion: 3,
      newVersion: 4,
    });
    expect(calls[0][1]).toBe(failure);
    expect(calls[0][2]).toBe('database update failed');
  });
});
