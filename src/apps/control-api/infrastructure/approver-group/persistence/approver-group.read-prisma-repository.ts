import { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  ApproverGroupOutput,
  ApproverGroupReadRepository,
} from '@/apps/control-api/application/approver-group';
import {
  normalizePagination,
  PaginatedResult,
  PaginationParams,
} from '@/shared/application/pagination';
import { PrismaService } from '@/shared/infrastructure/persistence';

type PrismaApproverGroupRead = Prisma.ApproverGroupGetPayload<{
  include: {
    members: {
      select: {
        approverId: true;
      };
    };
  };
}>;

@Injectable()
export class ApproverGroupReadPrismaRepository implements ApproverGroupReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ApproverGroupOutput | null> {
    const group = await this.prisma.approverGroup.findUnique({
      where: { id },
      include: { members: { select: { approverId: true } } },
    });
    if (!group) return null;

    return this.toOutput(group);
  }

  async findByOwnerId(ownerId: string): Promise<ApproverGroupOutput | null> {
    const group = await this.prisma.approverGroup.findUnique({
      where: { ownerId },
      include: { members: { select: { approverId: true } } },
    });
    if (!group) return null;

    return this.toOutput(group);
  }

  async findAll(params: PaginationParams): Promise<PaginatedResult<ApproverGroupOutput>> {
    const { limit, offset } = normalizePagination(params);

    const [groups, total] = await Promise.all([
      this.prisma.approverGroup.findMany({
        include: { members: { select: { approverId: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.approverGroup.count(),
    ]);

    return {
      data: groups.map((g) => this.toOutput(g)),
      total,
      limit,
      offset,
    };
  }

  private toOutput(raw: PrismaApproverGroupRead): ApproverGroupOutput {
    const memberIds = new Map(raw.members.map((member) => [member.approverId, member.approverId]));
    return {
      id: raw.id,
      ownerId: raw.ownerId,
      requiredApprovals: raw.requiredApprovals,
      memberIds: [...memberIds.keys()],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
