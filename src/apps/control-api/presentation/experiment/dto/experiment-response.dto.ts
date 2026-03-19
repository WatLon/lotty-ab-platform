import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExperimentOutcomeType,
  ExperimentStatus,
  ReviewDecision,
} from '@/apps/control-api/domain/experiment';

export class VariantResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String })
  declare name: string;

  @ApiProperty({ type: String })
  declare value: string;

  @ApiProperty({ type: Number })
  declare weight: number;

  @ApiProperty({ type: Boolean })
  declare isControl: boolean;
}

export class ReviewResponseInlineDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String, format: 'uuid' })
  declare reviewerId: string;

  @ApiProperty({ enum: ReviewDecision })
  declare decision: ReviewDecision;

  @ApiPropertyOptional({ type: String })
  declare comment: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;
}

export class ExperimentOutcomeResponseDto {
  @ApiProperty({ enum: ExperimentOutcomeType })
  declare type: ExperimentOutcomeType;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  declare winnerVariantId: string | null;

  @ApiProperty({ type: String })
  declare comment: string;

  @ApiProperty({ type: String, format: 'uuid' })
  declare decidedById: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare decidedAt: Date;
}

@ApiExtraModels(VariantResponseDto, ReviewResponseInlineDto, ExperimentOutcomeResponseDto)
export class ExperimentResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String })
  declare name: string;

  @ApiPropertyOptional({ type: String })
  declare description: string | null;

  @ApiProperty({ type: String, format: 'uuid' })
  declare flagId: string;

  @ApiProperty({ enum: ExperimentStatus })
  declare status: ExperimentStatus;

  @ApiPropertyOptional({ type: String })
  declare conflictDomain: string | null;

  @ApiProperty({ type: Number, default: 0 })
  declare priority: number;

  @ApiProperty({ type: Number })
  declare audiencePercent: number;

  @ApiPropertyOptional({ type: Object })
  declare targetingRule: unknown;

  @ApiProperty({ type: String, format: 'uuid' })
  declare ownerId: string;

  @ApiProperty({ type: [VariantResponseDto] })
  declare variants: VariantResponseDto[];

  @ApiProperty({ type: [String] })
  declare metricIds: string[];

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  declare primaryMetricId: string | null;

  @ApiProperty({ type: [ReviewResponseInlineDto] })
  declare reviews: ReviewResponseInlineDto[];

  @ApiPropertyOptional({ type: Object })
  declare outcome: ExperimentOutcomeResponseDto | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare startedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare pausedAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare updatedAt: Date | null;
}
