import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

export const AuthErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

const schemas: Record<AuthErrorCode, SchemaObject> = {
  [AuthErrorCode.UNAUTHORIZED]: errorSchema(
    AuthErrorCode.UNAUTHORIZED,
    'Authorization bearer token is required',
  ),
  [AuthErrorCode.INVALID_CREDENTIALS]: errorSchema(
    AuthErrorCode.INVALID_CREDENTIALS,
    'Invalid email or password',
  ),
};

SchemaRegistry.register(schemas);
