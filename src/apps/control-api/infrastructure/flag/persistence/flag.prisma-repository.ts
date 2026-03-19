import { Prisma, Flag as PrismaFlag } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  Flag,
  FlagId,
  FlagKey,
  FlagKeyAlreadyExistsError,
  FlagRepository,
} from '@/apps/control-api/domain/flag';
import { AppLogger } from '@/shared/application';
import { err, ok, Result, toError } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
} from '@/shared/infrastructure/persistence';
import { FlagMapper } from './flag.mapper';

@Injectable()
export class FlagPrismaRepository
  extends PrismaRepositoryBase<Flag, PrismaFlag, FlagId, FlagKeyAlreadyExistsError>
  implements FlagRepository
{
  protected readonly entityName = 'Flag';

  constructor(
    txManager: PrismaTransactionManager,
    private readonly appLogger: AppLogger,
    mapper: FlagMapper,
  ) {
    super(txManager, mapper);
  }

  async findById(id: FlagId): Promise<Flag | null> {
    return this.findOne(this.client.flag.findUnique({ where: { id: id.value } }));
  }

  async findByKey(key: FlagKey): Promise<Flag | null> {
    return this.findOne(this.client.flag.findUnique({ where: { key: key.value } }));
  }

  async findByKeys(keys: FlagKey[]): Promise<Flag[]> {
    if (keys.length === 0) return [];

    return this.findMany(
      this.client.flag.findMany({
        where: { key: { in: keys.map((k) => k.value) } },
      }),
    );
  }

  protected async doCreate(
    entity: Flag,
    version: number,
  ): Promise<Result<void, FlagKeyAlreadyExistsError>> {
    try {
      await this.client.flag.create({
        data: {
          id: entity.id.value,
          key: entity.key.value,
          valueType: entity.valueType,
          defaultValue: entity.defaultValue.value,
          description: entity.description,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt ?? new Date(),
          version,
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new FlagKeyAlreadyExistsError(entity.key));
      }
      throw toError(error);
    }
  }

  protected async doUpdate(
    entity: Flag,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, FlagKeyAlreadyExistsError>> {
    try {
      const updated = await prismaUpdateWithOptimisticLock({
        appLogger: this.appLogger,
        operation: 'FlagPrismaRepository.doUpdate',
        entity: this.entityName,
        entityId: entity.id.value,
        currentVersion,
        newVersion,
        update: async () => {
          await this.client.flag.update({
            where: { id: entity.id.value, version: currentVersion },
            data: {
              key: entity.key.value,
              valueType: entity.valueType,
              defaultValue: entity.defaultValue.value,
              description: entity.description,
              updatedAt: entity.updatedAt ?? new Date(),
              version: newVersion,
            },
          });
        },
      });
      return ok(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new FlagKeyAlreadyExistsError(entity.key));
      }
      throw toError(error);
    }
  }
}
