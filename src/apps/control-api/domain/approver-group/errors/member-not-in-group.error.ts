import { UserId } from '@/apps/control-api/domain/user';
import { BusinessRuleError } from '@/shared/domain/common';
import { ApproverGroupId } from '../approver-group.id';
import { ApproverGroupErrorCode } from './codes';

export interface MemberNotInGroupMetadata {
  groupId: string;
  userId: string;
}

export class MemberNotInGroupError extends BusinessRuleError {
  readonly code = ApproverGroupErrorCode.MEMBER_NOT_IN_GROUP;

  public readonly metadata: MemberNotInGroupMetadata;

  constructor(groupId: ApproverGroupId, userId: UserId) {
    super(`User "${userId.value}" is not a member of the approver group`);
    this.metadata = { groupId: groupId.value, userId: userId.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
