import { Module } from '@nestjs/common';
import {
  AddMemberToGroupUseCase,
  ApproverGroupReadRepository,
  CreateApproverGroupUseCase,
  GetApproverGroupForOwnerUseCase,
  GetApproverGroupUseCase,
  ListApproverGroupsUseCase,
  RemoveMemberFromGroupUseCase,
  UpdateApproverGroupUseCase,
} from '@/apps/control-api/application/approver-group';
import { ApproverGroupRepository } from '@/apps/control-api/domain/approver-group';
import { ApproverGroupController } from '@/apps/control-api/presentation/approver-group';
import { UserModule } from '../user/user.module';
import { ApproverGroupMapper } from './persistence/approver-group.mapper';
import { ApproverGroupPrismaRepository } from './persistence/approver-group.prisma-repository';
import { ApproverGroupReadPrismaRepository } from './persistence/approver-group.read-prisma-repository';

@Module({
  imports: [UserModule],
  controllers: [ApproverGroupController],
  providers: [
    CreateApproverGroupUseCase,
    UpdateApproverGroupUseCase,
    AddMemberToGroupUseCase,
    RemoveMemberFromGroupUseCase,
    GetApproverGroupUseCase,
    GetApproverGroupForOwnerUseCase,
    ListApproverGroupsUseCase,
    ApproverGroupMapper,
    { provide: ApproverGroupRepository, useClass: ApproverGroupPrismaRepository },
    { provide: ApproverGroupReadRepository, useClass: ApproverGroupReadPrismaRepository },
  ],
  exports: [ApproverGroupRepository, ApproverGroupReadRepository],
})
export class ApproverGroupModule {}
