import { UserId } from '@/apps/control-api/domain/user';
import { ConcurrencyError, Result } from '@/shared/domain/common';
import { ApproverGroup } from './approver-group.aggregate-root';
import { ApproverGroupId } from './approver-group.id';
import { ApproverGroupAlreadyExistsError } from './errors';

export abstract class ApproverGroupRepository {
  abstract findById(id: ApproverGroupId): Promise<ApproverGroup | null>;

  abstract findByOwnerId(ownerId: UserId): Promise<ApproverGroup | null>;

  abstract save(
    entity: ApproverGroup,
  ): Promise<Result<void, ConcurrencyError | ApproverGroupAlreadyExistsError>>;

  abstract delete(id: ApproverGroupId): Promise<void>;
}
