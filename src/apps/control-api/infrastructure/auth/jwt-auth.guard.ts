import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import {
  AuthenticatedUser,
  AuthTokenService,
  AuthUserRepository,
} from '@/apps/control-api/application/auth';
import { Role } from '@/apps/control-api/domain/user';
import { ForbiddenError, UnauthorizedError } from '@/shared/domain/common/errors';
import { IS_PUBLIC_KEY, ROLES_KEY } from '@/shared/presentation/common';

type RequestWithUser = FastifyRequest & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authTokenService: AuthTokenService,
    private readonly authUserRepository: AuthUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);
    const verified = this.authTokenService.verify(token);
    if (!verified) {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const identity = await this.authUserRepository.findIdentityById(verified.userId);
    if (!identity) {
      throw new UnauthorizedError('Authenticated user no longer exists');
    }

    request.user = {
      id: identity.id,
      role: identity.role,
    };

    this.ensureRoleAccess(context, identity.role);
    return true;
  }

  private extractBearerToken(request: FastifyRequest): string {
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;

    if (!value || !value.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization bearer token is required');
    }

    const token = value.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedError('Authorization bearer token is required');
    }

    return token;
  }

  private ensureRoleAccess(context: ExecutionContext, role: Role): void {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return;
    }

    if (requiredRoles.includes(role)) {
      return;
    }

    if (role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenError('auth', role);
  }
}
