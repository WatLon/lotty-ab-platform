import { Flag as PrismaFlag } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { FlagOutput, FlagReadRepository } from '@/apps/control-api/application/flag';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { DOMAIN_VALUE_TYPE_BY_PRISMA_VALUE_TYPE } from './flag.mapper';

@Injectable()
export class FlagReadPrismaRepository implements FlagReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<FlagOutput | null> {
    const flag = await this.prisma.flag.findUnique({ where: { id } });
    if (!flag) return null;

    return this.toOutput(flag);
  }

  async findAll(params: PaginationParams): Promise<PaginatedResult<FlagOutput>> {
    const { limit, offset } = normalizePagination(params);

    const [flags, total] = await Promise.all([
      this.prisma.flag.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.flag.count(),
    ]);

    return {
      data: flags.map((f) => this.toOutput(f)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(raw: PrismaFlag): FlagOutput {
    return {
      id: raw.id,
      key: raw.key,
      valueType: DOMAIN_VALUE_TYPE_BY_PRISMA_VALUE_TYPE[raw.valueType],
      defaultValue: raw.defaultValue,
      description: raw.description,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
