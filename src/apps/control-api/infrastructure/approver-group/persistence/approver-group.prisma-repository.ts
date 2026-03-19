import { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  ApproverGroup,
  ApproverGroupAlreadyExistsError,
  ApproverGroupId,
  ApproverGroupRepository,
} from '@/apps/control-api/domain/approver-group';
import { UserId } from '@/apps/control-api/domain/user';
import { AppLogger } from '@/shared/application';
import { err, ok, Result, toError } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
} from '@/shared/infrastructure/persistence';
import { ApproverGroupMapper, PrismaApproverGroupWithMembers } from './approver-group.mapper';

@Injectable()
export class ApproverGroupPrismaRepository
  extends PrismaRepositoryBase<
    ApproverGroup,
    PrismaApproverGroupWithMembers,
    ApproverGroupId,
    ApproverGroupAlreadyExistsError
  >
  implements ApproverGroupRepository
{
  protected readonly entityName = 'ApproverGroup';

  constructor(
    txManager: PrismaTransactionManager,
    private readonly appLogger: AppLogger,
    mapper: ApproverGroupMapper,
  ) {
    super(txManager, mapper);
  }

  async findById(id: ApproverGroupId): Promise<ApproverGroup | null> {
    return this.findOne(
      this.client.approverGroup.findUnique({
        where: { id: id.value },
        include: { members: { select: { approverId: true } } },
      }),
    );
  }

  async findByOwnerId(ownerId: UserId): Promise<ApproverGroup | null> {
    return this.findOne(
      this.client.approverGroup.findUnique({
        where: { ownerId: ownerId.value },
        include: { members: { select: { approverId: true } } },
      }),
    );
  }

  async delete(id: ApproverGroupId): Promise<void> {
    await this.client.approverGroup.delete({ where: { id: id.value } });
  }

  private getBaseData(entity: ApproverGroup) {
    return {
      id: entity.id.value,
      ownerId: entity.ownerId.value,
      requiredApprovals: entity.requiredApprovals.value,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt ?? new Date(),
    };
  }

  private getMembersData(entity: ApproverGroup) {
    return [...entity.memberIds.values()].map((userId) => ({ approverId: userId.value }));
  }

  protected async doCreate(
    entity: ApproverGroup,
    version: number,
  ): Promise<Result<void, ApproverGroupAlreadyExistsError>> {
    try {
      await this.client.approverGroup.create({
        data: {
          ...this.getBaseData(entity),
          version,
          members: { createMany: { data: this.getMembersData(entity) } },
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new ApproverGroupAlreadyExistsError(entity.ownerId));
      }
      throw toError(error);
    }
  }

  protected async doUpdate(
    entity: ApproverGroup,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, ApproverGroupAlreadyExistsError>> {
    try {
      const updated = await prismaUpdateWithOptimisticLock({
        appLogger: this.appLogger,
        operation: 'ApproverGroupPrismaRepository.doUpdate',
        entity: this.entityName,
        entityId: entity.id.value,
        currentVersion,
        newVersion,
        update: async () => {
          await this.client.approverGroup.update({
            where: { id: entity.id.value, version: currentVersion },
            data: {
              ...this.getBaseData(entity),
              version: newVersion,
              members: {
                deleteMany: {},
                createMany: { data: this.getMembersData(entity) },
              },
            },
          });
        },
      });
      return ok(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new ApproverGroupAlreadyExistsError(entity.ownerId));
      }
      throw toError(error);
    }
  }
}
