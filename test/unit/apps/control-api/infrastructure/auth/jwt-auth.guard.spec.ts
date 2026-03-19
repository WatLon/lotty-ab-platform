import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  AuthTokenService,
  AuthUserIdentity,
  AuthUserRepository,
  CreateBootstrapAdminInput,
  IssuedAuthToken,
  VerifiedAuthToken,
} from '@/apps/control-api/application/auth';
import { Role } from '@/apps/control-api/domain/user';
import { JwtAuthGuard } from '@/apps/control-api/infrastructure/auth/jwt-auth.guard';
import { ForbiddenError, UnauthorizedError } from '@/shared/domain/common/errors';
import { IS_PUBLIC_KEY, ROLES_KEY } from '@/shared/presentation/common';

class AuthTokenServiceStub extends AuthTokenService {
  public verified: VerifiedAuthToken | null = {
    userId: 'user-1',
    issuedAt: 100,
    expiresAt: 200,
    tokenId: 'jti-1',
  };

  public lastToken: string | null = null;

  issue(_userId: string): IssuedAuthToken {
    return { token: 'issued', expiresIn: 60 };
  }

  verify(token: string): VerifiedAuthToken | null {
    this.lastToken = token;
    return this.verified;
  }
}

class AuthUserRepositoryStub extends AuthUserRepository {
  public identity: AuthUserIdentity | null = { id: 'user-1', role: Role.VIEWER };

  public lastRequestedId: string | null = null;

  findCredentialsByEmail(): Promise<null> {
    return Promise.resolve(null);
  }

  findIdentityById(id: string): Promise<AuthUserIdentity | null> {
    this.lastRequestedId = id;
    return Promise.resolve(this.identity);
  }

  countUsers(): Promise<number> {
    return Promise.resolve(0);
  }

  createBootstrapAdmin(_input: CreateBootstrapAdminInput): Promise<string> {
    return Promise.resolve('admin-id');
  }
}

function createReflector(config?: {
  isPublic?: boolean;
  requiredRoles?: Role[] | undefined;
}): Reflector {
  return {
    getAllAndOverride<T>(key: string): T | undefined {
      if (key === IS_PUBLIC_KEY) return config?.isPublic as T | undefined;
      if (key === ROLES_KEY) return config?.requiredRoles as T | undefined;
      return undefined;
    },
  } as unknown as Reflector;
}

function createContext(
  request: Pick<FastifyRequest, 'headers'> & { user?: { id: string; role: Role } },
): ExecutionContextHost {
  class TestController {}
  const handler = () => undefined;
  return new ExecutionContextHost([request], TestController, handler);
}

describe('JwtAuthGuard', () => {
  it('allows public endpoints without authentication', async () => {
    const tokens = new AuthTokenServiceStub();
    const users = new AuthUserRepositoryStub();
    const guard = new JwtAuthGuard(createReflector({ isPublic: true }), tokens, users);
    const context = createContext({ headers: {} });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(tokens.lastToken).toBeNull();
    expect(users.lastRequestedId).toBeNull();
  });

  it('throws unauthorized when bearer header is missing or empty', async () => {
    const guard = new JwtAuthGuard(
      createReflector(),
      new AuthTokenServiceStub(),
      new AuthUserRepositoryStub(),
    );
    const missing = createContext({ headers: {} });
    const empty = createContext({ headers: { authorization: 'Bearer   ' } });

    await expect(guard.canActivate(missing)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(guard.canActivate(empty)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws unauthorized for invalid token and for removed identity', async () => {
    const invalidTokens = new AuthTokenServiceStub();
    invalidTokens.verified = null;
    const guardWithInvalidToken = new JwtAuthGuard(
      createReflector(),
      invalidTokens,
      new AuthUserRepositoryStub(),
    );

    await expect(
      guardWithInvalidToken.canActivate(
        createContext({ headers: { authorization: 'Bearer access-token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    const tokens = new AuthTokenServiceStub();
    const users = new AuthUserRepositoryStub();
    users.identity = null;
    const guardWithMissingUser = new JwtAuthGuard(createReflector(), tokens, users);

    await expect(
      guardWithMissingUser.canActivate(
        createContext({ headers: { authorization: 'Bearer access-token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('attaches request.user when token is valid and no roles are required', async () => {
    const guard = new JwtAuthGuard(
      createReflector(),
      new AuthTokenServiceStub(),
      new AuthUserRepositoryStub(),
    );
    const request: {
      headers: { authorization: string };
      user?: { id: string; role: Role };
    } = {
      headers: { authorization: 'Bearer access-token' },
    };
    const context = createContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 'user-1', role: Role.VIEWER });
  });

  it('enforces role access and allows admin override', async () => {
    const tokens = new AuthTokenServiceStub();
    const users = new AuthUserRepositoryStub();
    const viewerOnlyGuard = new JwtAuthGuard(
      createReflector({ requiredRoles: [Role.APPROVER] }),
      tokens,
      users,
    );

    await expect(
      viewerOnlyGuard.canActivate(
        createContext({ headers: { authorization: 'Bearer access-token' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    users.identity = { id: 'admin-1', role: Role.ADMIN };
    const adminGuard = new JwtAuthGuard(
      createReflector({ requiredRoles: [Role.EXPERIMENTER] }),
      tokens,
      users,
    );
    const adminResult = await adminGuard.canActivate(
      createContext({ headers: { authorization: 'Bearer access-token' } }),
    );
    expect(adminResult).toBe(true);

    users.identity = { id: 'approver-1', role: Role.APPROVER };
    const approverGuard = new JwtAuthGuard(
      createReflector({ requiredRoles: [Role.APPROVER] }),
      tokens,
      users,
    );
    const approverResult = await approverGuard.canActivate(
      createContext({ headers: { authorization: 'Bearer access-token' } }),
    );
    expect(approverResult).toBe(true);
  });
});
