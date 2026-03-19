import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AddMemberToGroupUseCase,
  CreateApproverGroupUseCase,
  GetApproverGroupForOwnerUseCase,
  GetApproverGroupUseCase,
  ListApproverGroupsUseCase,
  RemoveMemberFromGroupUseCase,
  UpdateApproverGroupUseCase,
} from '@/apps/control-api/application/approver-group';
import { ApproverGroupErrorCode } from '@/apps/control-api/domain/approver-group';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { AddMemberDto } from './dto/add-member.dto';
import { ApproverGroupResponseDto } from './dto/approver-group-response.dto';
import { CreateApproverGroupDto } from './dto/create-approver-group.dto';
import { UpdateApproverGroupDto } from './dto/update-approver-group.dto';

@ApiTags('Approver Groups')
@Controller('approver-groups')
@ApiBearerAuth('access-token')
export class ApproverGroupController {
  constructor(
    private readonly createApproverGroup: CreateApproverGroupUseCase,
    private readonly updateApproverGroup: UpdateApproverGroupUseCase,
    private readonly addMember: AddMemberToGroupUseCase,
    private readonly removeMember: RemoveMemberFromGroupUseCase,
    private readonly getApproverGroup: GetApproverGroupUseCase,
    private readonly getApproverGroupForOwner: GetApproverGroupForOwnerUseCase,
    private readonly listApproverGroups: ListApproverGroupsUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create an approver group (Admin only)' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: [ApproverGroupErrorCode.APPROVER_GROUP_ALREADY_EXISTS],
  })
  async create(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateApproverGroupDto,
  ) {
    return unwrapOrThrow(
      await this.createApproverGroup.execute({
        actorId,
        ownerId: dto.ownerId,
        requiredApprovals: dto.requiredApprovals,
      }),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List all approver groups' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true })
  async list(
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(await this.listApproverGroups.execute({ limit, offset }));
  }

  @Get('by-owner')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Get approver group by owner ID' })
  @ApiQuery({ name: 'ownerId', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: ApproverGroupResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: true })
  async getByOwner(
    @Query('ownerId', ParseUUIDPipe)
    ownerId: string,
  ) {
    return unwrapOrThrow(await this.getApproverGroupForOwner.execute({ ownerId }));
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Get approver group by ID' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: ApproverGroupResponseDto })
  @ApiErrorResponses({ notFound: true })
  async get(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return unwrapOrThrow(await this.getApproverGroup.execute({ groupId: id }));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update approver group (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, forbidden: true, notFound: true })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateApproverGroupDto,
  ) {
    unwrapOrThrow(
      await this.updateApproverGroup.execute({
        actorId,
        groupId: id,
        requiredApprovals: dto.requiredApprovals,
      }),
    );
    return { success: true };
  }

  @Post(':id/members')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Add member to approver group (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 201 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ApproverGroupErrorCode.MEMBER_ALREADY_IN_GROUP],
  })
  async addMemberToGroup(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: AddMemberDto,
  ) {
    unwrapOrThrow(
      await this.addMember.execute({
        actorId,
        groupId: id,
        userId: dto.userId,
      }),
    );
    return { success: true };
  }

  @Delete(':id/members/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove member from approver group (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'userId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [
      ApproverGroupErrorCode.MEMBER_NOT_IN_GROUP,
      ApproverGroupErrorCode.CANNOT_REMOVE_OWNER_FROM_GROUP,
    ],
  })
  async removeMemberFromGroup(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Param('userId', ParseUUIDPipe)
    userId: string,
  ) {
    unwrapOrThrow(
      await this.removeMember.execute({
        actorId,
        groupId: id,
        userId,
      }),
    );
    return { success: true };
  }
}
