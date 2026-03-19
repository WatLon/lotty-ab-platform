import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@/apps/control-api/application/user';
import { InvalidCredentialsError } from '@/apps/control-api/domain/auth';
import { err, ok, Result } from '@/shared/domain/common';
import { AuthTokenService } from './auth-token.service';
import { AuthUserRepository } from './auth-user.repository';
import { LoginCommand } from './login.command';
import { LoginOutput } from './login.output';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly authUserRepository: AuthUserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async execute(command: LoginCommand): Promise<Result<LoginOutput, InvalidCredentialsError>> {
    const email = command.email.trim().toLowerCase();
    const user = await this.authUserRepository.findCredentialsByEmail(email);
    if (!user) {
      return err(new InvalidCredentialsError());
    }

    const isValidPassword = await this.passwordHasher.verify(command.password, user.passwordHash);
    if (!isValidPassword) {
      return err(new InvalidCredentialsError());
    }

    const issued = this.authTokenService.issue(user.id);
    return ok({
      accessToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: issued.expiresIn,
    });
  }
}
