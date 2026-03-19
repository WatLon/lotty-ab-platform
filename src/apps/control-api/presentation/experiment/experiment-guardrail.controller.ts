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
  CreateGuardrailRuleUseCase,
  DeleteGuardrailRuleUseCase,
  GetGuardrailRuleUseCase,
  ListGuardrailRulesUseCase,
  UpdateGuardrailRuleUseCase,
} from '@/apps/control-api/application/guardrail';
import { GuardrailErrorCode } from '@/apps/control-api/domain/guardrail';
import { MetricErrorCode } from '@/apps/control-api/domain/metric';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import { CreateGuardrailRuleDto, GuardrailRuleResponseDto, UpdateGuardrailRuleDto } from './dto';

@ApiTags('Guardrails')
@Controller('experiments/:experimentId/guardrails')
@ApiBearerAuth('access-token')
export class ExperimentGuardrailController {
  constructor(
    private readonly createGuardrailRule: CreateGuardrailRuleUseCase,
    private readonly updateGuardrailRule: UpdateGuardrailRuleUseCase,
    private readonly deleteGuardrailRule: DeleteGuardrailRuleUseCase,
    private readonly getGuardrailRule: GetGuardrailRuleUseCase,
    private readonly listGuardrailRules: ListGuardrailRulesUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Create guardrail rule for experiment' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: [MetricErrorCode.METRIC_ARCHIVED, GuardrailErrorCode.GUARDRAIL_RULE_ALREADY_EXISTS],
  })
  async create(
    @CurrentUser()
    actorId: string,
    @Param('experimentId', ParseUUIDPipe)
    experimentId: string,
    @Body()
    dto: CreateGuardrailRuleDto,
  ) {
    return unwrapOrThrow(
      await this.createGuardrailRule.execute({
        actorId,
        experimentId,
        metricId: dto.metricId,
        threshold: dto.threshold,
        operator: dto.operator,
        windowMinutes: dto.windowMinutes,
        action: dto.action,
      }),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List guardrail rules for experiment' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  async list(
    @CurrentUser()
    actorId: string,
    @Param('experimentId', ParseUUIDPipe)
    experimentId: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(
      await this.listGuardrailRules.execute({
        actorId,
        experimentId,
        limit,
        offset,
      }),
    );
  }

  @Get(':guardrailId')
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'Get guardrail rule by id' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'guardrailId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200, type: GuardrailRuleResponseDto })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  async get(
    @CurrentUser()
    actorId: string,
    @Param('experimentId', ParseUUIDPipe)
    experimentId: string,
    @Param('guardrailId', ParseUUIDPipe)
    guardrailId: string,
  ) {
    return unwrapOrThrow(
      await this.getGuardrailRule.execute({
        actorId,
        experimentId,
        guardrailId,
      }),
    );
  }

  @Patch(':guardrailId')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Update guardrail rule' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'guardrailId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: [MetricErrorCode.METRIC_ARCHIVED, GuardrailErrorCode.GUARDRAIL_RULE_ALREADY_EXISTS],
  })
  async update(
    @CurrentUser()
    actorId: string,
    @Param('experimentId', ParseUUIDPipe)
    experimentId: string,
    @Param('guardrailId', ParseUUIDPipe)
    guardrailId: string,
    @Body()
    dto: UpdateGuardrailRuleDto,
  ) {
    unwrapOrThrow(
      await this.updateGuardrailRule.execute({
        actorId,
        experimentId,
        guardrailId,
        metricId: dto.metricId,
        threshold: dto.threshold,
        operator: dto.operator,
        windowMinutes: dto.windowMinutes,
        action: dto.action,
      }),
    );
    return { success: true };
  }

  @Delete(':guardrailId')
  @Roles(Role.ADMIN, Role.EXPERIMENTER)
  @ApiOperation({ summary: 'Delete guardrail rule' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'guardrailId', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  async delete(
    @CurrentUser()
    actorId: string,
    @Param('experimentId', ParseUUIDPipe)
    experimentId: string,
    @Param('guardrailId', ParseUUIDPipe)
    guardrailId: string,
  ) {
    unwrapOrThrow(
      await this.deleteGuardrailRule.execute({
        actorId,
        experimentId,
        guardrailId,
      }),
    );
    return { success: true };
  }
}
