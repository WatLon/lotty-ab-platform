import { ApiProperty } from '@nestjs/swagger';
import { GuardrailAction } from '@/apps/control-api/domain/guardrail';

export class GuardrailTriggerResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String, format: 'uuid' })
  declare guardrailId: string;

  @ApiProperty({ type: Number })
  declare metricValue: number;

  @ApiProperty({ type: Number })
  declare threshold: number;

  @ApiProperty({ enum: GuardrailAction })
  declare actionTaken: GuardrailAction;

  @ApiProperty({ type: String, format: 'date-time' })
  declare triggeredAt: Date;
}

export class PaginatedGuardrailTriggersResponseDto {
  @ApiProperty({ type: [GuardrailTriggerResponseDto] })
  declare data: GuardrailTriggerResponseDto[];

  @ApiProperty({ type: Number })
  declare total: number;

  @ApiProperty({ type: Number })
  declare limit: number;

  @ApiProperty({ type: Number })
  declare offset: number;
}
