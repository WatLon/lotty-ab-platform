import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetricResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String })
  declare key: string;

  @ApiProperty({ type: String })
  declare name: string;

  @ApiPropertyOptional({ type: String })
  declare description: string | null;

  @ApiProperty({ type: Object })
  declare formula: unknown;

  @ApiProperty({ type: Boolean })
  declare isArchived: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare updatedAt: Date | null;
}
