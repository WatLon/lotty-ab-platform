import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { UnauthorizedError } from '@/shared/domain/common/errors';

type RequestWithUser = FastifyRequest & { user?: { id?: string } };

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  const userId = request.user?.id;
  if (!userId) {
    throw new UnauthorizedError('Authenticated user is required');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    userId,
  );
  if (!isUuid) {
    throw new UnauthorizedError('Authenticated user id must be a valid UUID');
  }

  return userId;
});
