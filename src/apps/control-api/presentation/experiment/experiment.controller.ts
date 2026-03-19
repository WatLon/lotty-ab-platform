import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
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
  ArchiveExperimentUseCase,
  CompleteExperimentUseCase,
  CreateExperimentUseCase,
  GetExperimentUseCase,
  ListExperimentsUseCase,
  ListReviewsUseCase,
  PauseExperimentUseCase,
  ResumeExperimentUseCase,
  StartExperimentUseCase,
  SubmitForReviewUseCase,
  SubmitReviewUseCase,
  UpdateExperimentUseCase,
} from '@/apps/control-api/application/experiment';
import {
  ExperimentErrorCode,
  ExperimentStatus,
  ReviewDecision,
} from '@/apps/control-api/domain/experiment';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { CompleteExperimentDto } from './dto/complete-experiment.dto';
import { CreateExperimentDto } from './dto/create-experiment.dto';
import { ExperimentResponseDto } from './dto/experiment-response.dto';
import {
  ApproveExperimentDto,
  RejectExperimentDto,
  RequestChangesDto,
} from './dto/review-experiment.dto';
import { UpdateExperimentDto } from './dto/update-experiment.dto';

@ApiTags('Experiments')
@Controller('experiments')
@ApiBearerAuth('access-token')
export class ExperimentController {
  constructor(
    private readonly createExperiment: CreateExperimentUseCase,
    private readonly updateExperiment: UpdateExperimentUseCase,
    private readonly submitForReview: SubmitForReviewUseCase,
    private readonly submitReview: SubmitReviewUseCase,
    private readonly startExperiment: StartExperimentUseCase,
    private readonly pauseExperiment: PauseExperimentUseCase,
    private readonly resumeExperiment: ResumeExperimentUseCase,
    private readonly completeExperiment: CompleteExperimentUseCase,
    private readonly archiveExperiment: ArchiveExperimentUseCase,
    private readonly getExperiment: GetExperimentUseCase,
    private readonly listExperiments: ListExperimentsUseCase,
    private readonly listReviewsUseCase: ListReviewsUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Create an experiment' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: [
      ExperimentErrorCode.EXPERIMENT_ALREADY_EXISTS_FOR_FLAG,
      ExperimentErrorCode.MINIMUM_VARIANTS_REQUIRED,
      ExperimentErrorCode.NO_CONTROL_VARIANT,
      ExperimentErrorCode.MULTIPLE_CONTROL_VARIANTS,
      ExperimentErrorCode.VARIANTS_WEIGHT_MISMATCH,
    ],
  })
  async create(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateExperimentDto,
  ) {
    return unwrapOrThrow(
      await this.createExperiment.execute({
        actorId,
        name: dto.name,
        description: dto.description ?? null,
        flagId: dto.flagId,
        conflictDomain: dto.conflictDomain ?? null,
        priority: dto.priority ?? null,
        audiencePercent: dto.audiencePercent,
        targetingRule: dto.targetingRule ?? null,
        variants: dto.variants,
        metricIds: dto.metricIds ?? [],
        primaryMetricId: dto.primaryMetricId ?? null,
      }),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List experiments' })
  @ApiQuery({ name: 'flagId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'status', required: false, enum: Object.values(ExperimentStatus) })
  @ApiQuery({ name: 'ownerId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true })
  async list(
    @Query('flagId')
    flagId?: string,
    @Query('status', new ParseEnumPipe(ExperimentStatus, { optional: true }))
    status?: string,
    @Query('ownerId')
    ownerId?: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(
      await this.listExperiments.execute({
        flagId,
        status: status as ExperimentStatus | undefined,
        ownerId,
        limit,
        offset,
      }),
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Get experiment by ID' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: ExperimentResponseDto })
  @ApiErrorResponses({ notFound: true })
  async get(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return unwrapOrThrow(await this.getExperiment.execute({ experimentId: id }));
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Update experiment (only in DRAFT status)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.EXPERIMENT_NOT_EDITABLE],
  })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: UpdateExperimentDto,
  ) {
    unwrapOrThrow(
      await this.updateExperiment.execute({
        actorId,
        experimentId: id,
        name: dto.name,
        description: dto.description,
        audiencePercent: dto.audiencePercent,
        targetingRule: dto.targetingRule,
        metricIds: dto.metricIds,
        primaryMetricId: dto.primaryMetricId,
      }),
    );

    return { success: true };
  }

  @Post(':id/submit')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Submit experiment for review' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: [
      ExperimentErrorCode.INVALID_STATUS_TRANSITION,
      ExperimentErrorCode.MINIMUM_VARIANTS_REQUIRED,
      ExperimentErrorCode.NO_CONTROL_VARIANT,
      ExperimentErrorCode.MULTIPLE_CONTROL_VARIANTS,
      ExperimentErrorCode.VARIANTS_WEIGHT_MISMATCH,
    ],
  })
  @HttpCode(200)
  async submit(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.submitForReview.execute({ actorId, experimentId: id }));
    return { success: true };
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN, Role.APPROVER)
  @ApiOperation({ summary: 'Approve experiment (Approver/Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async approve(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: ApproveExperimentDto,
  ) {
    unwrapOrThrow(
      await this.submitReview.execute({
        actorId,
        experimentId: id,
        decision: ReviewDecision.APPROVED,
        comment: dto.comment ?? null,
      }),
    );

    return { success: true };
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN, Role.APPROVER)
  @ApiOperation({ summary: 'Reject experiment (Approver/Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async reject(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: RejectExperimentDto,
  ) {
    unwrapOrThrow(
      await this.submitReview.execute({
        actorId,
        experimentId: id,
        decision: ReviewDecision.REJECTED,
        comment: dto.comment,
      }),
    );

    return { success: true };
  }

  @Post(':id/request-changes')
  @Roles(Role.ADMIN, Role.APPROVER)
  @ApiOperation({ summary: 'Request changes on experiment (Approver/Admin only)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async requestChanges(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: RequestChangesDto,
  ) {
    unwrapOrThrow(
      await this.submitReview.execute({
        actorId,
        experimentId: id,
        decision: ReviewDecision.CHANGES_REQUESTED,
        comment: dto.comment,
      }),
    );

    return { success: true };
  }

  @Get(':id/reviews')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List reviews for experiment' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ notFound: true })
  async listReviews(
    @Param('id', ParseUUIDPipe)
    id: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(
      await this.listReviewsUseCase.execute({ experimentId: id, limit, offset }),
    );
  }

  @Post(':id/start')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Start experiment (APPROVED → RUNNING)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async start(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.startExperiment.execute({ actorId, experimentId: id }));
    return { success: true };
  }

  @Post(':id/pause')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Pause experiment' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async pause(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.pauseExperiment.execute({ actorId, experimentId: id }));
    return { success: true };
  }

  @Post(':id/resume')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Resume paused experiment' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async resume(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.resumeExperiment.execute({ actorId, experimentId: id }));
    return { success: true };
  }

  @Post(':id/complete')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Complete experiment with outcome' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [
      ExperimentErrorCode.INVALID_STATUS_TRANSITION,
      ExperimentErrorCode.OUTCOME_REQUIRED_FOR_COMPLETION,
      ExperimentErrorCode.WINNER_VARIANT_REQUIRED,
      ExperimentErrorCode.VARIANT_NOT_FOUND,
    ],
  })
  @HttpCode(200)
  async complete(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
    @Body()
    dto: CompleteExperimentDto,
  ) {
    unwrapOrThrow(
      await this.completeExperiment.execute({
        actorId,
        experimentId: id,
        outcomeType: dto.outcomeType,
        winnerVariantId: dto.winnerVariantId ?? null,
        comment: dto.comment,
      }),
    );

    return { success: true };
  }

  @Post(':id/archive')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Archive experiment (COMPLETED → ARCHIVED)' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: [ExperimentErrorCode.INVALID_STATUS_TRANSITION],
  })
  @HttpCode(200)
  async archive(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    unwrapOrThrow(await this.archiveExperiment.execute({ actorId, experimentId: id }));
    return { success: true };
  }
}
