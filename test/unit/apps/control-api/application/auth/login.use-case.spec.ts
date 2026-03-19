import { describe, expect, it } from 'vitest';
import {
  AuthTokenService,
  AuthUserCredentials,
  AuthUserIdentity,
  AuthUserRepository,
  CreateBootstrapAdminInput,
  IssuedAuthToken,
  VerifiedAuthToken,
} from '@/apps/control-api/application/auth';
import { LoginUseCase } from '@/apps/control-api/application/auth/login.use-case';
import { PasswordHasher } from '@/apps/control-api/application/user';
import { Role } from '@/apps/control-api/domain/user';

class AuthUserRepositoryStub extends AuthUserRepository {
  credentials: AuthUserCredentials | null = null;

  lastEmail: string | null = null;

  async findCredentialsByEmail(email: string): Promise<AuthUserCredentials | null> {
    this.lastEmail = email;
    return this.credentials;
  }

  async findIdentityById(_id: string): Promise<AuthUserIdentity | null> {
    return null;
  }

  async countUsers(): Promise<number> {
    return 0;
  }

  async createBootstrapAdmin(_input: CreateBootstrapAdminInput): Promise<string> {
    return 'id';
  }
}

class PasswordHasherStub extends PasswordHasher {
  verifyResult = false;

  async hash(_plainPassword: string): Promise<string> {
    return 'hash';
  }

  async verify(_plainPassword: string, _hashedPassword: string): Promise<boolean> {
    return this.verifyResult;
  }

  needsRehash(_hashedPassword: string): boolean {
    return false;
  }
}

class AuthTokenServiceStub extends AuthTokenService {
  issued: IssuedAuthToken = { token: 'jwt', expiresIn: 3600 };

  lastUserId: string | null = null;

  issue(userId: string): IssuedAuthToken {
    this.lastUserId = userId;
    return this.issued;
  }

  verify(_token: string): VerifiedAuthToken | null {
    return null;
  }
}

describe('LoginUseCase', () => {
  it('returns InvalidCredentialsError when user is not found', async () => {
    const users = new AuthUserRepositoryStub();
    const useCase = new LoginUseCase(users, new PasswordHasherStub(), new AuthTokenServiceStub());

    const result = await useCase.execute({
      email: '  USER@example.com ',
      password: 'Password123',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_CREDENTIALS');
    }
    expect(users.lastEmail).toBe('user@example.com');
  });

  it('returns InvalidCredentialsError when password is invalid', async () => {
    const users = new AuthUserRepositoryStub();
    users.credentials = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'hash',
      role: Role.ADMIN,
    };
    const hasher = new PasswordHasherStub();
    hasher.verifyResult = false;

    const result = await new LoginUseCase(users, hasher, new AuthTokenServiceStub()).execute({
      email: 'user@example.com',
      password: 'wrong',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('issues token when credentials are valid', async () => {
    const users = new AuthUserRepositoryStub();
    users.credentials = {
      id: 'user-2',
      email: 'user2@example.com',
      passwordHash: 'hash',
      role: Role.EXPERIMENTER,
    };
    const hasher = new PasswordHasherStub();
    hasher.verifyResult = true;
    const tokens = new AuthTokenServiceStub();
    tokens.issued = {
      token: 'access-token',
      expiresIn: 1800,
    };

    const result = await new LoginUseCase(users, hasher, tokens).execute({
      email: 'user2@example.com',
      password: 'Password123',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        accessToken: 'access-token',
        tokenType: 'Bearer',
        expiresIn: 1800,
      });
    }
    expect(tokens.lastUserId).toBe('user-2');
  });
});
