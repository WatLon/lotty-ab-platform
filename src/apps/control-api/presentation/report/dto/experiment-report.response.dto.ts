import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportMetricPointDto {
  @ApiProperty({ type: String })
  declare bucket: string;

  @ApiPropertyOptional({ type: Number })
  declare value: number | null;
}

export class ReportMetricDto {
  @ApiProperty({ type: String })
  declare metricKey: string;

  @ApiProperty({ type: String })
  declare metricName: string;

  @ApiProperty({ type: Boolean })
  declare isPrimary: boolean;

  @ApiPropertyOptional({ type: Number })
  declare value: number | null;

  @ApiProperty({ type: [ReportMetricPointDto] })
  declare points: ReportMetricPointDto[];
}

export class ReportVariantDto {
  @ApiProperty({ type: String })
  declare variantId: string;

  @ApiProperty({ type: [ReportMetricDto] })
  declare metrics: ReportMetricDto[];
}

export class ExperimentReportResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare experimentId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare from: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare to: string;

  @ApiProperty({ enum: ['minute', 'hour'] })
  declare bucket: 'minute' | 'hour';

  @ApiProperty({ type: [ReportVariantDto] })
  declare variants: ReportVariantDto[];
}
