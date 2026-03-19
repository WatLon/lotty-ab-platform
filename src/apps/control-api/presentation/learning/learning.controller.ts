import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ArchiveLearningEntryUseCase,
  CreateLearningEntryUseCase,
  FindSimilarLearningsUseCase,
  GetLearningEntryUseCase,
  ListLearningEntriesUseCase,
  UpdateLearningEntryUseCase,
} from '@/apps/control-api/application/learning';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import {
  CreateLearningEntryDto,
  FindSimilarLearningsDto,
  ListLearningEntriesQueryDto,
  UpdateLearningEntryDto,
} from './dto';

@ApiTags('Learnings')
@Controller('learnings')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
export class LearningController {
  constructor(
    private readonly createLearning: CreateLearningEntryUseCase,
    private readonly updateLearning: UpdateLearningEntryUseCase,
    private readonly archiveLearning: ArchiveLearningEntryUseCase,
    private readonly getLearning: GetLearningEntryUseCase,
    private readonly listLearnings: ListLearningEntriesUseCase,
    private readonly findSimilarLearnings: FindSimilarLearningsUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Create learning entry' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async create(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateLearningEntryDto,
  ) {
    return unwrapOrThrow(
      await this.createLearning.execute({
        actorId,
        experimentId: dto.experimentId ?? null,
        featureKey: dto.featureKey ?? null,
        team: dto.team ?? null,
        title: dto.title,
        hypothesis: dto.hypothesis,
        primaryMetricKey: dto.primaryMetricKey,
        guardrailMetricKeys: dto.guardrailMetricKeys ?? [],
        result: dto.result ?? null,
        actionTaken: dto.actionTaken,
        summary: dto.summary,
        notes: dto.notes ?? null,
        tags: dto.tags ?? [],
        countries: dto.countries ?? [],
        platforms: dto.platforms ?? [],
        reportUrl: dto.reportUrl ?? null,
        ticketUrl: dto.ticketUrl ?? null,
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List learnings with search and filters' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'experimentId', required: false, type: String })
  @ApiQuery({ name: 'featureKey', required: false, type: String })
  @ApiQuery({ name: 'team', required: false, type: String })
  @ApiQuery({ name: 'result', required: false, enum: Object.values(ExperimentOutcomeType) })
  @ApiQuery({ name: 'countries', required: false, type: String })
  @ApiQuery({ name: 'platforms', required: false, type: String })
  @ApiQuery({ name: 'includeArchived', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'createdFrom', required: false, type: String })
  @ApiQuery({ name: 'createdTo', required: false, type: String })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ unauthorized: true, forbidden: true, badRequest: true })
  async list(
    @Query()
    query: ListLearningEntriesQueryDto,
  ) {
    return unwrapOrThrow(
      await this.listLearnings.execute({
        limit: query.limit,
        offset: query.offset,
        q: query.q,
        experimentId: query.experimentId,
        featureKey: query.featureKey,
        team: query.team,
        result: query.result,
        countries: query.countries,
        platforms: query.platforms,
        includeArchived: query.includeArchived,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
      }),
    );
  }

  @Get('similar')
  @ApiOperation({ summary: 'Find similar learnings by learningId or experimentId' })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true })
  async similar(
    @Query()
    query: FindSimilarLearningsDto,
  ) {
    return unwrapOrThrow(
      await this.findSimilarLearnings.execute({
        learningId: query.learningId,
        experimentId: query.experimentId,
        limit: query.limit,
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get learning entry by id' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ notFound: true, unauthorized: true, forbidden: true })
  async getById(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return unwrapOrThrow(await this.getLearning.execute({ id }));
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Update learning entry' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, notFound: true, unauthorized: true, forbidden: true })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateLearningEntryDto,
  ) {
    unwrapOrThrow(
      await this.updateLearning.execute({
        actorId,
        learningId: id,
        experimentId: dto.experimentId,
        featureKey: dto.featureKey,
        team: dto.team,
        title: dto.title,
        hypothesis: dto.hypothesis,
        primaryMetricKey: dto.primaryMetricKey,
        guardrailMetricKeys: dto.guardrailMetricKeys,
        result: dto.result,
        actionTaken: dto.actionTaken,
        summary: dto.summary,
        notes: dto.notes,
        tags: dto.tags,
        countries: dto.countries,
        platforms: dto.platforms,
        reportUrl: dto.reportUrl,
        ticketUrl: dto.ticketUrl,
      }),
    );
    return { success: true };
  }

  @Post(':id/archive')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Archive learning entry' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ notFound: true, unauthorized: true, forbidden: true })
  async archive(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(
      await this.archiveLearning.execute({
        actorId,
        learningId: id,
      }),
    );
    return { success: true };
  }
}
