import { Prisma, User as PrismaUser } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  EmailAlreadyExistsError,
  User,
  UserEmail,
  UserId,
  UserRepository,
} from '@/apps/control-api/domain/user';
import { AppLogger } from '@/shared/application';
import { err, ok, Result, toError } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
} from '@/shared/infrastructure/persistence';
import { UserMapper } from './user.mapper';

@Injectable()
export class UserPrismaRepository
  extends PrismaRepositoryBase<User, PrismaUser, UserId, EmailAlreadyExistsError>
  implements UserRepository
{
  protected readonly entityName = 'User';

  constructor(
    txManager: PrismaTransactionManager,
    private readonly appLogger: AppLogger,
    mapper: UserMapper,
  ) {
    super(txManager, mapper);
  }

  async findById(id: UserId): Promise<User | null> {
    return this.findOne(this.client.user.findUnique({ where: { id: id.value } }));
  }

  async findByEmail(email: UserEmail): Promise<User | null> {
    return this.findOne(this.client.user.findUnique({ where: { email: email.value } }));
  }

  async delete(id: UserId): Promise<void> {
    await this.client.user.delete({ where: { id: id.value } });
  }

  protected async doCreate(
    entity: User,
    version: number,
  ): Promise<Result<void, EmailAlreadyExistsError>> {
    try {
      await this.client.user.create({
        data: {
          id: entity.id.value,
          email: entity.email.value,
          password: entity.password.hashedValue,
          name: entity.name.value,
          role: entity.role,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt ?? new Date(),
          version,
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new EmailAlreadyExistsError(entity.email));
      }
      throw toError(error);
    }
  }

  protected async doUpdate(
    entity: User,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, EmailAlreadyExistsError>> {
    try {
      const updated = await prismaUpdateWithOptimisticLock({
        appLogger: this.appLogger,
        operation: 'UserPrismaRepository.doUpdate',
        entity: this.entityName,
        entityId: entity.id.value,
        currentVersion,
        newVersion,
        update: async () => {
          await this.client.user.update({
            where: { id: entity.id.value, version: currentVersion },
            data: {
              email: entity.email.value,
              password: entity.password.hashedValue,
              name: entity.name.value,
              role: entity.role,
              updatedAt: entity.updatedAt ?? new Date(),
              version: newVersion,
            },
          });
        },
      });
      return ok(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new EmailAlreadyExistsError(entity.email));
      }
      throw toError(error);
    }
  }
}
