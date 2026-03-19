import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DecideUseCase } from '@/apps/decide-api/application';
import { getEnv } from '@/shared/infrastructure/config';
import { ApiErrorResponses, Public, unwrapOrThrow } from '@/shared/presentation/common';
import {
  METRIC_LOTTY_DECIDE_DURATION_MS,
  METRIC_LOTTY_DECIDE_TOTAL,
  MetricsService,
} from '@/shared/presentation/metrics';
import { DecideRequestDto } from './dto/decide-request.dto';
import { DecideResponseDto } from './dto/decide-response.dto';

const env = getEnv();
const decideThrottleLimit = env.DECIDE_THROTTLE_DISABLED
  ? Number.MAX_SAFE_INTEGER
  : env.DECIDE_THROTTLE_LIMIT;

@ApiTags('Runtime')
@Public()
@Throttle({ default: { ttl: env.DECIDE_THROTTLE_TTL_MS, limit: decideThrottleLimit } })
@Controller('decide')
export class DecideController {
  constructor(
    private readonly decideUseCase: DecideUseCase,
    private readonly metrics: MetricsService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get flag values for a subject',
    description:
      'Resolves flag values considering active experiments, targeting rules, and audience allocation. ' +
      'Returns a decision ID for each flag that must be used to attribute subsequent events.',
  })
  @ApiResponse({ status: 200, type: DecideResponseDto })
  @ApiErrorResponses({ badRequest: true })
  async decide(
    @Body()
    dto: DecideRequestDto,
  ): Promise<DecideResponseDto> {
    const startedAt = performance.now();
    this.metrics.increment(METRIC_LOTTY_DECIDE_TOTAL);

    try {
      const decisions = unwrapOrThrow(
        await this.decideUseCase.execute({
          subjectId: dto.subjectId,
          attributes: dto.attributes ?? {},
          flagKeys: dto.flagKeys,
        }),
      );
      return { decisions };
    } finally {
      const durationMs = performance.now() - startedAt;
      this.metrics.observeHistogram(METRIC_LOTTY_DECIDE_DURATION_MS, durationMs);
    }
  }
}
