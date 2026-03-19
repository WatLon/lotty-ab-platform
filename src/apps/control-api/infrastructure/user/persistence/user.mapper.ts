import { Role as PrismaRole, User as PrismaUser } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  Role,
  User,
  UserEmail,
  UserId,
  UserName,
  UserPassword,
} from '@/apps/control-api/domain/user';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

export const DOMAIN_ROLE_BY_PRISMA_ROLE: Record<PrismaRole, Role> = {
  ADMIN: Role.ADMIN,
  EXPERIMENTER: Role.EXPERIMENTER,
  APPROVER: Role.APPROVER,
  VIEWER: Role.VIEWER,
};

@Injectable()
export class UserMapper implements PersistenceMapper<User, PrismaUser> {
  toDomain(raw: PrismaUser): User {
    return User.reconstitute(
      {
        email: UserEmail.reconstitute(raw.email),
        password: UserPassword.reconstitute(raw.password),
        name: UserName.reconstitute(raw.name),
        role: DOMAIN_ROLE_BY_PRISMA_ROLE[raw.role],
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      UserId.from(raw.id),
    );
  }
}
