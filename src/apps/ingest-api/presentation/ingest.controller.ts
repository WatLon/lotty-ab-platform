import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IngestEventsUseCase } from '@/apps/ingest-api/application';
import { ApiErrorResponses, Public, unwrapOrThrow } from '@/shared/presentation/common';
import { METRIC_LOTTY_INGEST_TOTAL, MetricsService } from '@/shared/presentation/metrics';
import { IngestEventsRequestDto, IngestEventsResponseDto } from './dto/ingest-events.dto';

@ApiTags('Events')
@Public()
@Throttle({ default: { ttl: 1000, limit: 100 } })
@Controller('events')
export class IngestController {
  constructor(
    private readonly ingestEvents: IngestEventsUseCase,
    private readonly metrics: MetricsService,
  ) {}

  @Post('ingest')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ingest batch of events',
    description:
      'Accepts a batch of product events. Returns counts of accepted and rejected events.',
  })
  @ApiResponse({ status: 200, type: IngestEventsResponseDto })
  @ApiErrorResponses({ badRequest: true })
  async ingest(
    @Body()
    dto: IngestEventsRequestDto,
  ): Promise<IngestEventsResponseDto> {
    this.metrics.increment(METRIC_LOTTY_INGEST_TOTAL);
    const output = unwrapOrThrow(await this.ingestEvents.execute({ events: dto.events }));
    return {
      accepted: output.accepted,
      duplicates: output.duplicates,
      rejected: output.rejected,
      errors: output.errors.map((error) => ({
        index: error.metadata.index,
        eventId: error.metadata.eventId,
        code: error.code,
        message: error.message,
      })),
    };
  }
}
