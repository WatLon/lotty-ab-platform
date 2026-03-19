import { ApiProperty } from '@nestjs/swagger';

export class CreatedIdResponseDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  declare id: string;
}
