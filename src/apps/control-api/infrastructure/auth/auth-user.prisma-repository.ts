import { Role as PrismaRole } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  AuthUserCredentials,
  AuthUserIdentity,
  AuthUserRepository,
  CreateBootstrapAdminInput,
} from '@/apps/control-api/application/auth';
import { Role } from '@/apps/control-api/domain/user';
import { PrismaService } from '@/shared/infrastructure/persistence';

const DOMAIN_ROLE_BY_PRISMA_ROLE: Record<PrismaRole, Role> = {
  ADMIN: Role.ADMIN,
  APPROVER: Role.APPROVER,
  EXPERIMENTER: Role.EXPERIMENTER,
  VIEWER: Role.VIEWER,
};

@Injectable()
export class AuthUserPrismaRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCredentialsByEmail(email: string): Promise<AuthUserCredentials | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, role: true },
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      role: DOMAIN_ROLE_BY_PRISMA_ROLE[user.role],
    };
  }

  async findIdentityById(id: string): Promise<AuthUserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) return null;

    return {
      id: user.id,
      role: DOMAIN_ROLE_BY_PRISMA_ROLE[user.role],
    };
  }

  async countUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  async createBootstrapAdmin(input: CreateBootstrapAdminInput): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { email: input.email.trim().toLowerCase() },
      update: {
        password: input.passwordHash,
        name: input.name.trim(),
        role: PrismaRole.ADMIN,
      },
      create: {
        email: input.email.trim().toLowerCase(),
        password: input.passwordHash,
        name: input.name.trim(),
        role: PrismaRole.ADMIN,
      },
      select: { id: true },
    });

    return user.id;
  }
}
