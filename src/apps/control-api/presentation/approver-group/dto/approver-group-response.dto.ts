import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproverGroupResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String, format: 'uuid' })
  declare ownerId: string;

  @ApiProperty({ type: Number })
  declare requiredApprovals: number;

  @ApiProperty({ type: [String], format: 'uuid' })
  declare memberIds: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare updatedAt: Date | null;
}
