import { ApiProperty } from '@nestjs/swagger';
import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';

export class GuardrailRuleResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String, format: 'uuid' })
  declare experimentId: string;

  @ApiProperty({ type: String, format: 'uuid' })
  declare metricId: string;

  @ApiProperty({ type: String })
  declare metricKey: string;

  @ApiProperty({ type: String })
  declare metricName: string;

  @ApiProperty({ type: Number })
  declare threshold: number;

  @ApiProperty({ enum: ComparisonOperator })
  declare operator: ComparisonOperator;

  @ApiProperty({ type: Number })
  declare windowMinutes: number;

  @ApiProperty({ enum: GuardrailAction })
  declare action: GuardrailAction;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;
}
