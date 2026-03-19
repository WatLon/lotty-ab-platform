import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventTypeResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String })
  declare key: string;

  @ApiProperty({ type: String })
  declare name: string;

  @ApiPropertyOptional({ type: String })
  declare description: string | null;

  @ApiPropertyOptional({ type: Object })
  declare schema: unknown;

  @ApiProperty({ type: Boolean })
  declare requiresExposure: boolean;

  @ApiProperty({ type: Boolean })
  declare isArchived: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare updatedAt: Date | null;
}
