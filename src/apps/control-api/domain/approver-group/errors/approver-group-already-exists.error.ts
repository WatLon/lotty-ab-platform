import { UserId } from '@/apps/control-api/domain/user';
import { BusinessRuleError } from '@/shared/domain/common';
import { ApproverGroupErrorCode } from './codes';

export interface ApproverGroupAlreadyExistsMetadata {
  ownerId: string;
}

export class ApproverGroupAlreadyExistsError extends BusinessRuleError {
  readonly code = ApproverGroupErrorCode.APPROVER_GROUP_ALREADY_EXISTS;

  public readonly metadata: ApproverGroupAlreadyExistsMetadata;

  constructor(ownerId: UserId) {
    super(`Approver group for owner "${ownerId.value}" already exists`);
    this.metadata = { ownerId: ownerId.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
