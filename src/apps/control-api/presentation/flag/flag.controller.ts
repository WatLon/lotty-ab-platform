import {
  Body,
  Controller,
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
  CreateFlagUseCase,
  GetFlagUseCase,
  ListFlagsUseCase,
  UpdateFlagUseCase,
} from '@/apps/control-api/application/flag';
import { FlagErrorCode } from '@/apps/control-api/domain/flag';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { CreateFlagDto } from './dto/create-flag.dto';
import { FlagResponseDto } from './dto/flag-response.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';

@ApiTags('Feature Flags')
@Controller('flags')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
export class FlagController {
  constructor(
    private readonly createFlag: CreateFlagUseCase,
    private readonly updateFlag: UpdateFlagUseCase,
    private readonly getFlag: GetFlagUseCase,
    private readonly listFlags: ListFlagsUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a feature flag' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    unauthorized: true,
    forbidden: true,
    conflict: [FlagErrorCode.FLAG_KEY_ALREADY_EXISTS],
  })
  async create(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateFlagDto,
  ) {
    const result = unwrapOrThrow(
      await this.createFlag.execute({
        actorId,
        key: dto.key,
        valueType: dto.valueType,
        defaultValue: dto.defaultValue,
        description: dto.description ?? null,
      }),
    );
    return result;
  }

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List all flags' })
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
    return unwrapOrThrow(await this.listFlags.execute({ limit, offset }));
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Get flag by ID' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: FlagResponseDto })
  @ApiErrorResponses({ unauthorized: true, forbidden: true, notFound: true })
  async get(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return unwrapOrThrow(await this.getFlag.execute({ flagId: id }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update flag default value' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateFlagDto,
  ) {
    unwrapOrThrow(
      await this.updateFlag.execute({
        actorId,
        flagId: id,
        defaultValue: dto.defaultValue,
        description: dto.description,
      }),
    );
    return { success: true };
  }
}
