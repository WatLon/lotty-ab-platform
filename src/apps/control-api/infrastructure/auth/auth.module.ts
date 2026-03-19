import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  AuthTokenService,
  AuthUserRepository,
  LoginUseCase,
} from '@/apps/control-api/application/auth';
import { PasswordHasher } from '@/apps/control-api/application/user';
import { AuthController } from '@/apps/control-api/presentation/auth';
import { AuthUserPrismaRepository } from './auth-user.prisma-repository';
import { BootstrapAdminService } from './bootstrap-admin.service';
import { HmacJwtAuthTokenService } from './hmac-jwt-auth-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Argon2PasswordHasher } from './security/argon2-password-hasher';

@Module({
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    BootstrapAdminService,
    AuthUserPrismaRepository,
    { provide: AuthUserRepository, useExisting: AuthUserPrismaRepository },
    { provide: AuthTokenService, useClass: HmacJwtAuthTokenService },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthTokenService, AuthUserRepository, PasswordHasher],
})
export class AuthModule {}
