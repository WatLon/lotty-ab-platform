import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { PasswordHasher } from '@/apps/control-api/application/user';
import { AppLogger } from '@/shared/application';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly appLogger: AppLogger) {}

  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'security.password.verify.exception',
          domain: 'security',
          operation: 'Argon2PasswordHasher.verify',
          status: 'failure',
        },
        error,
        'password hash check exception',
      );
      return false;
    }
  }
  needsRehash(hashedPassword: string): boolean {
    try {
      return argon2.needsRehash(hashedPassword, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'security.password.rehash.exception',
          domain: 'security',
          operation: 'Argon2PasswordHasher.needsRehash',
          status: 'failure',
        },
        error,
        'password rehash check exception',
      );
      return false;
    }
  }
}
