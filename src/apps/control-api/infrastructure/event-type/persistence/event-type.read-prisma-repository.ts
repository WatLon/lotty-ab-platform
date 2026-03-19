import { EventType as PrismaEventType } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  EventTypeOutput,
  EventTypeReadRepository,
} from '@/apps/control-api/application/event-type';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

@Injectable()
export class EventTypeReadPrismaRepository implements EventTypeReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<EventTypeOutput | null> {
    const raw = await this.prisma.eventType.findUnique({ where: { id } });
    if (!raw) return null;

    return this.toOutput(raw);
  }

  async findAll(params: PaginationParams): Promise<PaginatedResult<EventTypeOutput>> {
    const { limit, offset } = normalizePagination(params);
    const [types, total] = await Promise.all([
      this.prisma.eventType.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.eventType.count(),
    ]);
    return {
      data: types.map((t) => this.toOutput(t)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(raw: PrismaEventType): EventTypeOutput {
    return {
      id: raw.id,
      key: raw.key,
      name: raw.name,
      description: raw.description,
      schema: raw.schema,
      requiresExposure: raw.requiresExposure,
      isArchived: raw.isArchived,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
