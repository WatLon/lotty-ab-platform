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
  ArchiveEventTypeUseCase,
  CreateEventTypeUseCase,
  ListEventTypesUseCase,
  UpdateEventTypeUseCase,
} from '@/apps/control-api/application/event-type';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { CreateEventTypeDto } from './dto/create-event-type.dto';
import { UpdateEventTypeDto } from './dto/update-event-type.dto';

@ApiTags('Event Types')
@Controller('event-types')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
export class EventTypeController {
  constructor(
    private readonly createEventType: CreateEventTypeUseCase,
    private readonly updateEventType: UpdateEventTypeUseCase,
    private readonly archiveEventType: ArchiveEventTypeUseCase,
    private readonly listEventTypes: ListEventTypesUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create event type' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true })
  async create(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateEventTypeDto,
  ) {
    const result = unwrapOrThrow(
      await this.createEventType.execute({
        actorId,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        schema: (dto.schema ?? null) as Record<string, unknown> | null,
        requiresExposure: dto.requiresExposure,
      }),
    );
    return result;
  }

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List event types' })
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
    return unwrapOrThrow(await this.listEventTypes.execute({ limit, offset }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event type' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateEventTypeDto,
  ) {
    unwrapOrThrow(
      await this.updateEventType.execute({
        actorId,
        eventTypeId: id,
        name: dto.name,
        description: dto.description,
        schema: dto.schema,
      }),
    );
    return { success: true };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive event type' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ unauthorized: true, forbidden: true, notFound: true })
  async archive(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.archiveEventType.execute({ actorId, eventTypeId: id }));
    return { success: true };
  }
}
