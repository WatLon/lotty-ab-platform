import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlagValueType } from '@/apps/control-api/domain/flag';

export class FlagResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String })
  declare key: string;

  @ApiProperty({ enum: FlagValueType })
  declare valueType: FlagValueType;

  @ApiProperty({ type: String })
  declare defaultValue: string;

  @ApiPropertyOptional({ type: String })
  declare description: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare updatedAt: Date | null;
}
