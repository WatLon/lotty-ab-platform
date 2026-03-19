import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { UserErrorCode } from '@/apps/control-api/domain/user';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

const schemas: Record<UserErrorCode, SchemaObject> = {
  [UserErrorCode.USER_EMAIL_ALREADY_EXISTS]: errorSchema(
    UserErrorCode.USER_EMAIL_ALREADY_EXISTS,
    'User with email "user@example.com" already exists',
    {
      email: { type: 'string', example: 'user@example.com' },
    },
  ),
  [UserErrorCode.USER_CANNOT_CHANGE_OWN_ROLE]: errorSchema(
    UserErrorCode.USER_CANNOT_CHANGE_OWN_ROLE,
    'Cannot change your own role',
  ),
  [UserErrorCode.USER_CANNOT_DELETE_SELF]: errorSchema(
    UserErrorCode.USER_CANNOT_DELETE_SELF,
    'Cannot delete your own account',
  ),
};

SchemaRegistry.register(schemas);

export { UserErrorCode };
