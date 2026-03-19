import { User as PrismaUser } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { UserOutput, UserReadRepository } from '@/apps/control-api/application/user';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { DOMAIN_ROLE_BY_PRISMA_ROLE } from './user.mapper';

@Injectable()
export class UserReadPrismaRepository implements UserReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserOutput | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    return this.toOutput(user);
  }

  async findByEmail(email: string): Promise<UserOutput | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    return this.toOutput(user);
  }

  async findAll(params: PaginationParams): Promise<PaginatedResult<UserOutput>> {
    const { limit, offset } = normalizePagination(params);
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count(),
    ]);
    return {
      data: users.map((u) => this.toOutput(u)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(raw: PrismaUser): UserOutput {
    return {
      id: raw.id,
      email: raw.email,
      name: raw.name,
      role: DOMAIN_ROLE_BY_PRISMA_ROLE[raw.role],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
