import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionReason } from '@/apps/decide-api/domain';

export class FlagDecisionResponseDto {
  @ApiProperty({ type: String, example: 'button_color' })
  declare flagKey: string;

  @ApiProperty({ type: String, example: 'blue' })
  declare value: string;

  @ApiProperty({
    type: String,
    description: 'Stateless signed decision token (HMAC-SHA256)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlIjoiZXhwLTEiLCJ2IjoidmFyLTEiLCJ1IjoidXNlci00MiJ9.UmFsP0y5j9ZJCPx7e9RXT5nA5-1T8ScEw4rkgE3q7z8',
  })
  declare decisionId: string;

  @ApiProperty({ enum: DecisionReason })
  declare reason: DecisionReason;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  declare experimentId: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  declare variantId: string | null;
}

export class DecideResponseDto {
  @ApiProperty({ type: [FlagDecisionResponseDto] })
  declare decisions: FlagDecisionResponseDto[];
}
