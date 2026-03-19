import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetExperimentReportUseCase } from '@/apps/control-api/application/report';
import {
  ceilMetricRollupDate,
  floorMetricRollupDate,
  METRIC_ROLLUP_BUCKETS,
} from '@/apps/control-api/domain/metric';
import { Role } from '@/apps/control-api/domain/user';
import { ApiErrorResponses, Roles, unwrapOrThrow } from '@/shared/presentation/common';
import { ExperimentReportResponseDto } from './dto/experiment-report.response.dto';
import { GetExperimentReportQueryDto } from './dto/get-experiment-report.query.dto';

@ApiTags('Reports')
@Controller('reports')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN, Role.EXPERIMENTER, Role.APPROVER, Role.VIEWER)
export class ReportController {
  constructor(private readonly getExperimentReportUseCase: GetExperimentReportUseCase) {}

  @Get('experiments/:experimentId')
  @ApiOperation({ summary: 'Get experiment report by variants and metrics' })
  @ApiParam({ name: 'experimentId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'from', required: true, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'to', required: true, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'bucket', required: false, enum: METRIC_ROLLUP_BUCKETS })
  @ApiResponse({ status: 200, type: ExperimentReportResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: true, forbidden: true, notFound: true })
  async getExperimentReport(
    @Param('experimentId') experimentId: string,
    @Query() query: GetExperimentReportQueryDto,
  ): Promise<ExperimentReportResponseDto> {
    const from = floorMetricRollupDate(query.from, query.bucket);
    const to = ceilMetricRollupDate(query.to, query.bucket);

    return unwrapOrThrow(
      await this.getExperimentReportUseCase.execute({
        experimentId,
        from,
        to,
        bucket: query.bucket,
      }),
    );
  }
}
