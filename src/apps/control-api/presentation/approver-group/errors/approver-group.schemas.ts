import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ApproverGroupErrorCode } from '@/apps/control-api/domain/approver-group';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

const schemas: Record<ApproverGroupErrorCode, SchemaObject> = {
  [ApproverGroupErrorCode.APPROVER_GROUP_ALREADY_EXISTS]: errorSchema(
    ApproverGroupErrorCode.APPROVER_GROUP_ALREADY_EXISTS,
    'Approver group for owner already exists',
    {
      ownerId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
    },
  ),
  [ApproverGroupErrorCode.MEMBER_ALREADY_IN_GROUP]: errorSchema(
    ApproverGroupErrorCode.MEMBER_ALREADY_IN_GROUP,
    'User is already a member of the approver group',
    {
      groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      userId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
    },
  ),
  [ApproverGroupErrorCode.MEMBER_NOT_IN_GROUP]: errorSchema(
    ApproverGroupErrorCode.MEMBER_NOT_IN_GROUP,
    'User is not a member of the approver group',
    {
      groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      userId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
    },
  ),
  [ApproverGroupErrorCode.CANNOT_REMOVE_OWNER_FROM_GROUP]: errorSchema(
    ApproverGroupErrorCode.CANNOT_REMOVE_OWNER_FROM_GROUP,
    'Cannot remove the owner from the approver group',
    {
      groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
    },
  ),
};

SchemaRegistry.register(schemas);

export { ApproverGroupErrorCode };
