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
  CreateNotificationChannelUseCase,
  CreateNotificationRuleUseCase,
  ListNotificationChannelsUseCase,
  ListNotificationDeliveriesUseCase,
  ListNotificationRulesUseCase,
  UpdateNotificationChannelUseCase,
  UpdateNotificationRuleUseCase,
} from '@/apps/control-api/application/notification';
import { NotificationDeliveryStatus } from '@/apps/control-api/domain/notification';
import { Role } from '@/apps/control-api/domain/user';
import {
  ApiErrorResponses,
  CreatedIdResponseDto,
  CurrentUser,
  Roles,
  unwrapOrThrow,
} from '@/shared/presentation/common';
import {
  CreateNotificationChannelDto,
  CreateNotificationRuleDto,
  ListNotificationDeliveriesQueryDto,
  UpdateNotificationChannelDto,
  UpdateNotificationRuleDto,
} from './dto';

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
export class NotificationController {
  constructor(
    private readonly createChannel: CreateNotificationChannelUseCase,
    private readonly updateChannel: UpdateNotificationChannelUseCase,
    private readonly listChannels: ListNotificationChannelsUseCase,
    private readonly createRule: CreateNotificationRuleUseCase,
    private readonly updateRule: UpdateNotificationRuleUseCase,
    private readonly listRules: ListNotificationRulesUseCase,
    private readonly listDeliveries: ListNotificationDeliveriesUseCase,
  ) {}

  @Post('channels')
  @ApiOperation({ summary: 'Create notification channel' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true })
  async createNotificationChannel(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateNotificationChannelDto,
  ) {
    return unwrapOrThrow(
      await this.createChannel.execute({
        actorId,
        name: dto.name,
        type: dto.type,
        config: dto.config,
        isEnabled: dto.isEnabled ?? null,
      }),
    );
  }

  @Get('channels')
  @ApiOperation({ summary: 'List notification channels' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ unauthorized: true, forbidden: true })
  async getNotificationChannels(
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(await this.listChannels.execute({ limit, offset }));
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: 'Update notification channel' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async patchNotificationChannel(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    channelId: string,
    @Body()
    dto: UpdateNotificationChannelDto,
  ) {
    unwrapOrThrow(
      await this.updateChannel.execute({
        actorId,
        channelId,
        name: dto.name,
        config: dto.config,
        isEnabled: dto.isEnabled,
      }),
    );

    return { success: true };
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create notification rule' })
  @ApiResponse({ status: 201, type: CreatedIdResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async createNotificationRule(
    @CurrentUser()
    actorId: string,
    @Body()
    dto: CreateNotificationRuleDto,
  ) {
    return unwrapOrThrow(
      await this.createRule.execute({
        actorId,
        name: dto.name,
        event: dto.event,
        scopeType: dto.scopeType ?? null,
        scopeValue: dto.scopeValue ?? null,
        metricKey: dto.metricKey ?? null,
        severity: dto.severity ?? null,
        environment: dto.environment ?? null,
        rateLimitCount: dto.rateLimitCount ?? null,
        rateLimitWindowSec: dto.rateLimitWindowSec ?? null,
        dedupeWindowSec: dto.dedupeWindowSec ?? null,
        messageTemplate: dto.messageTemplate ?? null,
        isEnabled: dto.isEnabled ?? null,
        targets: dto.targets.map((target) => ({
          channelId: target.channelId,
          address: target.address ?? null,
        })),
      }),
    );
  }

  @Get('rules')
  @ApiOperation({ summary: 'List notification rules' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ unauthorized: true, forbidden: true })
  async getNotificationRules(
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ) {
    return unwrapOrThrow(await this.listRules.execute({ limit, offset }));
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update notification rule' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async patchNotificationRule(
    @CurrentUser()
    actorId: string,
    @Param('id', ParseUUIDPipe)
    ruleId: string,
    @Body()
    dto: UpdateNotificationRuleDto,
  ) {
    unwrapOrThrow(
      await this.updateRule.execute({
        actorId,
        ruleId,
        name: dto.name,
        event: dto.event,
        scopeType: dto.scopeType,
        scopeValue: dto.scopeValue,
        metricKey: dto.metricKey,
        severity: dto.severity,
        environment: dto.environment,
        rateLimitCount: dto.rateLimitCount,
        rateLimitWindowSec: dto.rateLimitWindowSec,
        dedupeWindowSec: dto.dedupeWindowSec,
        messageTemplate: dto.messageTemplate,
        isEnabled: dto.isEnabled,
        targets: dto.targets,
      }),
    );

    return { success: true };
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'List notification deliveries' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'ruleId', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: Object.values(NotificationDeliveryStatus),
  })
  @ApiResponse({ status: 200 })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true })
  async getNotificationDeliveries(
    @Query()
    query: ListNotificationDeliveriesQueryDto,
  ) {
    return unwrapOrThrow(
      await this.listDeliveries.execute({
        limit: query.limit,
        offset: query.offset,
        ruleId: query.ruleId,
        status: query.status,
      }),
    );
  }
}
