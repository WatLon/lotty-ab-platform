import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewDecision } from '@/apps/control-api/domain/experiment';

export class ReviewResponseDto {
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
