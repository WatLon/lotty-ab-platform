import { ApproverGroup } from '@/apps/control-api/domain/approver-group/approver-group.aggregate-root';
import { RequiredApprovals } from '@/apps/control-api/domain/approver-group/value-objects/required-approvals.vo';
import { UserId } from '@/apps/control-api/domain/user/user.id';
import { ApproverGroupMapper } from '@/apps/control-api/infrastructure/approver-group/persistence/approver-group.mapper';
import { ApproverGroupPrismaRepository } from '@/apps/control-api/infrastructure/approver-group/persistence/approver-group.prisma-repository';
import { PrismaTransactionManager } from '@/shared/infrastructure/persistence/prisma-transaction-manager';
import {
  callDoUpdate,
  createAppLoggerSpy,
  createKnownRequestError,
  unwrap,
} from '../../../../../../support/prisma-repo-testkit';

function createApproverGroupEntity(): ApproverGroup {
  return unwrap(
    ApproverGroup.create({
      ownerId: UserId.generate(),
      requiredApprovals: RequiredApprovals.reconstitute(1),
    }),
  );
}

describe('ApproverGroupPrismaRepository.doUpdate', () => {
  it('returns false on Prisma P2025 error', async () => {
    const client = {
      approverGroup: {
        update: async () => {
          throw createKnownRequestError('P2025');
        },
      },
    };
    const txManager = {
      getClient: () => client,
    } as unknown as PrismaTransactionManager;
    const { appLogger, calls } = createAppLoggerSpy();
    const repository = new ApproverGroupPrismaRepository(
      txManager,
      appLogger,
      new ApproverGroupMapper(),
    );

    const result = await callDoUpdate(repository, createApproverGroupEntity(), 1, 2);

    expect(result).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('logs and rethrows unknown errors', async () => {
    const failure = new Error('db down');
    const client = {
      approverGroup: {
        update: async () => {
          throw failure;
        },
      },
    };
    const txManager = {
      getClient: () => client,
    } as unknown as PrismaTransactionManager;
    const { appLogger, calls } = createAppLoggerSpy();
    const repository = new ApproverGroupPrismaRepository(
      txManager,
      appLogger,
      new ApproverGroupMapper(),
    );

    await expect(callDoUpdate(repository, createApproverGroupEntity(), 3, 4)).rejects.toThrow(
      'db down',
    );

    expect(calls).toHaveLength(1);
    expect(calls[0][0].operation).toBe('ApproverGroupPrismaRepository.doUpdate');
    expect(calls[0][0].meta).toMatchObject({
      entity: 'ApproverGroup',
      currentVersion: 3,
      newVersion: 4,
    });
    expect(calls[0][1]).toBe(failure);
    expect(calls[0][2]).toBe('database update failed');
  });
});
