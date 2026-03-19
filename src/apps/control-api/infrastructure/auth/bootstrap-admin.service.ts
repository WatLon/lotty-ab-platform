import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AuthUserRepository } from '@/apps/control-api/application/auth';
import { PasswordHasher } from '@/apps/control-api/application/user';
import { AppLogger } from '@/shared/application';
import { TypedConfigService } from '@/shared/infrastructure/config';

@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  constructor(
    private readonly config: TypedConfigService,
    private readonly authUserRepository: AuthUserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly appLogger: AppLogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const usersCount = await this.authUserRepository.countUsers();
    if (usersCount > 0) {
      return;
    }

    const email = this.config.get('BOOTSTRAP_ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get('BOOTSTRAP_ADMIN_PASSWORD')?.trim();
    const name = this.config.get('BOOTSTRAP_ADMIN_NAME')?.trim();

    if (!email || !password || !name) {
      throw new Error(
        'BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME are required when no users exist',
      );
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const id = await this.authUserRepository.createBootstrapAdmin({ email, passwordHash, name });

    this.appLogger.info(
      {
        event: 'security.bootstrap_admin.created',
        domain: 'security',
        operation: 'BootstrapAdminService.onApplicationBootstrap',
        status: 'success',
        meta: { userId: id, email },
      },
      'bootstrap admin user created',
    );
  }
}
