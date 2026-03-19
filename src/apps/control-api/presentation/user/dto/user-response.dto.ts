import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/apps/control-api/domain/user';

export class UserResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare id: string;

  @ApiProperty({ type: String })
  declare email: string;

  @ApiProperty({ type: String })
  declare name: string;

  @ApiProperty({ enum: Role })
  declare role: Role;

  @ApiProperty({ type: String, format: 'date-time' })
  declare createdAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  declare updatedAt: Date | null;
}
