import { BusinessRuleError } from '@/shared/domain/common';
import { ApproverGroupId } from '../approver-group.id';
import { ApproverGroupErrorCode } from './codes';

export interface CannotRemoveOwnerFromGroupMetadata {
  groupId: string;
}

export class CannotRemoveOwnerFromGroupError extends BusinessRuleError {
  readonly code = ApproverGroupErrorCode.CANNOT_REMOVE_OWNER_FROM_GROUP;

  public readonly metadata: CannotRemoveOwnerFromGroupMetadata;

  constructor(groupId: ApproverGroupId) {
    super('Cannot remove the owner from the approver group');
    this.metadata = { groupId: groupId.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
