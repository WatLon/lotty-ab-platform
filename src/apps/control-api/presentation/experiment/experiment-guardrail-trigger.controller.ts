import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ListGuardrailTriggersUseCase } from '@/apps/control-api/application/guardrail';
import { GuardrailAction } from '@/apps/control-api/domain/guardrail';
import { Role } from '@/apps/control-api/domain/user';
import { ApiErrorResponses, CurrentUser, Roles, unwrapOrThrow } from '@/shared/presentation/common';
import { ListGuardrailTriggersQueryDto, PaginatedGuardrailTriggersResponseDto } from './dto';

@ApiTags('Guardrails')
@Controller('experiments/:experimentId/guardrail-triggers')
@ApiBearerAuth('access-token')
export class ExperimentGuardrailTriggerController {
  constructor(private readonly listGuardrailTriggers: ListGuardrailTriggersUseCase) {}

  @Get()
  @Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
  @ApiOperation({ summary: 'List guardrail triggers for experiment' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'guardrailId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'actionTaken', required: false, enum: Object.values(GuardrailAction) })
  @ApiResponse({ status: 200, type: PaginatedGuardrailTriggersResponseDto })
  @ApiErrorResponses({ badRequest: true, forbidden: true, notFound: true })
  async list(
    @CurrentUser()
    actorId: string,
    @Param('experimentId', ParseUUIDPipe)
    experimentId: string,
    @Query()
    query: ListGuardrailTriggersQueryDto,
  ) {
    return unwrapOrThrow(
      await this.listGuardrailTriggers.execute({
        actorId,
        experimentId,
        limit: query.limit,
        offset: query.offset,
        guardrailId: query.guardrailId,
        actionTaken: query.actionTaken,
      }),
    );
  }
}
