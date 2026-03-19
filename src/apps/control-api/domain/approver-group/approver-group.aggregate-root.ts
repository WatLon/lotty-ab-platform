import { UserId } from '@/apps/control-api/domain/user';
import { AggregateRoot, err, ok, Result } from '@/shared/domain/common';
import { ApproverGroupId } from './approver-group.id';
import {
  CannotRemoveOwnerFromGroupError,
  MemberAlreadyInGroupError,
  MemberNotInGroupError,
} from './errors';
import { RequiredApprovals } from './value-objects/required-approvals.vo';

export interface ApproverGroupProps {
  ownerId: UserId;
  requiredApprovals: RequiredApprovals;
  memberIds: Map<string, UserId>;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateApproverGroupProps {
  ownerId: UserId;
  requiredApprovals: RequiredApprovals;
}

export class ApproverGroup extends AggregateRoot<ApproverGroupProps, ApproverGroupId> {
  private constructor(props: ApproverGroupProps, id: ApproverGroupId) {
    super(props, id);
  }

  static create(props: CreateApproverGroupProps): Result<ApproverGroup, never> {
    return ok(
      new ApproverGroup(
        {
          ownerId: props.ownerId,
          requiredApprovals: props.requiredApprovals,
          memberIds: new Map<string, UserId>(),
          createdAt: new Date(),
          updatedAt: null,
        },
        ApproverGroupId.generate(),
      ),
    );
  }

  static reconstitute(props: ApproverGroupProps, id: ApproverGroupId): ApproverGroup {
    return new ApproverGroup(props, id);
  }

  get ownerId(): UserId {
    return this.props.ownerId;
  }

  get requiredApprovals(): RequiredApprovals {
    return this.props.requiredApprovals;
  }

  get memberIds(): ReadonlyMap<string, UserId> {
    return this.props.memberIds;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  changeRequiredApprovals(requiredApprovals: RequiredApprovals): void {
    if (requiredApprovals.equals(this.props.requiredApprovals)) return;

    this.props.requiredApprovals = requiredApprovals;
    this.props.updatedAt = new Date();
  }

  addMember(userId: UserId): Result<void, MemberAlreadyInGroupError> {
    if (this.props.memberIds.has(userId.value)) {
      return err(new MemberAlreadyInGroupError(this.id, userId));
    }

    this.props.memberIds.set(userId.value, userId);
    this.props.updatedAt = new Date();

    return ok(undefined);
  }

  removeMember(
    userId: UserId,
  ): Result<void, MemberNotInGroupError | CannotRemoveOwnerFromGroupError> {
    if (userId.equals(this.props.ownerId)) {
      return err(new CannotRemoveOwnerFromGroupError(this.id));
    }

    if (!this.props.memberIds.has(userId.value)) {
      return err(new MemberNotInGroupError(this.id, userId));
    }

    this.props.memberIds.delete(userId.value);
    this.props.updatedAt = new Date();

    return ok(undefined);
  }

  hasMember(userId: UserId): boolean {
    return this.props.memberIds.has(userId.value);
  }

  canApprove(userId: UserId): boolean {
    return this.hasMember(userId);
  }
}
