import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
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
  ArchiveMetricUseCase,
  CreateMetricUseCase,
  GetMetricUseCase,
  ListMetricsUseCase,
  UpdateMetricUseCase,
} from '@/apps/control-api/application/metric';
import { MetricErrorCode } from '@/apps/control-api/domain/metric';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { CreateMetricDto, MetricResponseDto, UpdateMetricDto } from './dto';

@ApiTags('Metrics')
@Controller('metric-definitions')
@ApiBearerAuth('access-token')
export class MetricController {
  constructor(
    private readonly createMetric: CreateMetricUseCase,
    private readonly updateMetric: UpdateMetricUseCase,
    private readonly archiveMetric: ArchiveMetricUseCase,
    private readonly getMetric: GetMetricUseCase,
    private readonly listMetrics: ListMetricsUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create metric (Admin only)' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    unauthorized: true,
    forbidden: true,
    notFound: true,
    conflict: [MetricErrorCode.METRIC_KEY_ALREADY_EXISTS, 'CONCURRENCY_CONFLICT'],
  })
  async create(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateMetricDto,
  ) {
    return unwrapOrThrow(
      await this.createMetric.execute({
        actorId,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        formula: dto.formula,
      }),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List metrics' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ unauthorized: true, notFound: true })
  async list(
    @CurrentUser()
    actorId: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
    @Query('includeArchived', new ParseBoolPipe({ optional: true }))
    includeArchived?: boolean,
  ) {
    return unwrapOrThrow(
      await this.listMetrics.execute({
        actorId,
        limit,
        offset,
        includeArchived,
      }),
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Get metric by id' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: MetricResponseDto })
  @ApiErrorResponses({ unauthorized: true, notFound: true })
  async get(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return unwrapOrThrow(await this.getMetric.execute({ actorId, metricId: id }));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update metric metadata (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    badRequest: true,
    unauthorized: true,
    forbidden: true,
    notFound: true,
    conflict: ['CONCURRENCY_CONFLICT'],
  })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateMetricDto,
  ) {
    unwrapOrThrow(
      await this.updateMetric.execute({
        actorId,
        metricId: id,
        name: dto.name,
        description: dto.description,
      }),
    );
    return { success: true };
  }

  @Post(':id/archive')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Archive metric (Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    unauthorized: true,
    forbidden: true,
    notFound: true,
    conflict: [MetricErrorCode.METRIC_IN_USE_BY_ACTIVE_GUARDRAILS, 'CONCURRENCY_CONFLICT'],
  })
  async archive(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.archiveMetric.execute({ actorId, metricId: id }));
    return { success: true };
  }
}
