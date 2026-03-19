import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginUseCase } from '@/apps/control-api/application/auth';
import { ApiErrorResponses, Public, unwrapOrThrow } from '@/shared/presentation/common';
import { LoginDto, LoginResponseDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 1000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiErrorResponses({ badRequest: true, unauthorized: ['INVALID_CREDENTIALS'] })
  async login(
    @Body()
    dto: LoginDto,
  ): Promise<LoginResponseDto> {
    return unwrapOrThrow(
      await this.loginUseCase.execute({
        email: dto.email,
        password: dto.password,
      }),
    );
  }
}
