import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ type: String, enum: ['Bearer'], example: 'Bearer' })
  declare tokenType: 'Bearer';

  @ApiProperty({ type: Number, example: 900 })
  declare expiresIn: number;

  @ApiProperty({
    type: String,
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  declare accessToken: string;
}
