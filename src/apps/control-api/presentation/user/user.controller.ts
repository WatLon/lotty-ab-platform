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
  ChangeRoleUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  GetUserUseCase,
  ListUsersUseCase,
  UpdateUserUseCase,
} from '@/apps/control-api/application/user';
import { Role, UserErrorCode } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
export class UserController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly changeRole: ChangeRoleUseCase,
    private readonly deleteUser: DeleteUserUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly listUsers: ListUsersUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    unauthorized: true,
    forbidden: true,
    conflict: [UserErrorCode.USER_EMAIL_ALREADY_EXISTS],
  })
  async create(
    @Body()
    dto: CreateUserDto,
  ) {
    return unwrapOrThrow(
      await this.createUser.execute({
        email: dto.email,
        password: dto.password,
        name: dto.name,
        role: dto.role ?? null,
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ unauthorized: true, forbidden: true })
  async list(
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(await this.listUsers.execute({ limit, offset }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiErrorResponses({ unauthorized: true, forbidden: true, notFound: true })
  async get(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return unwrapOrThrow(await this.getUser.execute({ userId: id }));
  }

  @Patch('me')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, notFound: true })
  async updateMe(
    @CurrentUser()
    userId: string,
    @Body()
    dto: UpdateUserDto,
  ) {
    unwrapOrThrow(
      await this.updateUser.execute({
        userId,
        name: dto.name,
      }),
    );
    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async update(
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateUserDto,
  ) {
    unwrapOrThrow(
      await this.updateUser.execute({
        userId: id,
        name: dto.name,
      }),
    );
    return { success: true };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change user role (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    unauthorized: true,
    notFound: true,
    forbidden: true,
    conflict: [UserErrorCode.USER_CANNOT_CHANGE_OWN_ROLE],
  })
  async changeUserRole(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: ChangeRoleDto,
  ) {
    unwrapOrThrow(
      await this.changeRole.execute({
        actorId,
        targetUserId: id,
        role: dto.role,
      }),
    );
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    unauthorized: true,
    notFound: true,
    forbidden: true,
    conflict: [UserErrorCode.USER_CANNOT_DELETE_SELF],
  })
  async delete(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(
      await this.deleteUser.execute({
        actorId,
        targetUserId: id,
      }),
    );
    return { success: true };
  }
}
