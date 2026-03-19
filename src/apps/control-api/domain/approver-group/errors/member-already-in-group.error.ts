import { UserId } from '@/apps/control-api/domain/user';
import { BusinessRuleError } from '@/shared/domain/common';
import { ApproverGroupId } from '../approver-group.id';
import { ApproverGroupErrorCode } from './codes';

export interface MemberAlreadyInGroupMetadata {
  groupId: string;
  userId: string;
}

export class MemberAlreadyInGroupError extends BusinessRuleError {
  readonly code = ApproverGroupErrorCode.MEMBER_ALREADY_IN_GROUP;

  public readonly metadata: MemberAlreadyInGroupMetadata;

  constructor(groupId: ApproverGroupId, userId: UserId) {
    super(`User "${userId.value}" is already a member of the approver group`);
    this.metadata = { groupId: groupId.value, userId: userId.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
