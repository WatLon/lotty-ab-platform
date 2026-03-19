import type { Prisma } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  ApproverGroup,
  ApproverGroupId,
  RequiredApprovals,
} from '@/apps/control-api/domain/approver-group';
import { UserId } from '@/apps/control-api/domain/user';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

export type PrismaApproverGroupWithMembers = Prisma.ApproverGroupGetPayload<{
  include: {
    members: {
      select: {
        approverId: true;
      };
    };
  };
}>;

@Injectable()
export class ApproverGroupMapper
  implements PersistenceMapper<ApproverGroup, PrismaApproverGroupWithMembers>
{
  toDomain(raw: PrismaApproverGroupWithMembers): ApproverGroup {
    return ApproverGroup.reconstitute(
      {
        ownerId: UserId.from(raw.ownerId),
        requiredApprovals: RequiredApprovals.reconstitute(raw.requiredApprovals),
        memberIds: new Map(raw.members.map((m) => [m.approverId, UserId.from(m.approverId)])),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      ApproverGroupId.from(raw.id),
    );
  }
}
