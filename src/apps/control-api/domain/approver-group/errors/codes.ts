export const ApproverGroupErrorCode = {
  APPROVER_GROUP_ALREADY_EXISTS: 'APPROVER_GROUP_ALREADY_EXISTS',
  MEMBER_ALREADY_IN_GROUP: 'MEMBER_ALREADY_IN_GROUP',
  MEMBER_NOT_IN_GROUP: 'MEMBER_NOT_IN_GROUP',
  CANNOT_REMOVE_OWNER_FROM_GROUP: 'CANNOT_REMOVE_OWNER_FROM_GROUP',
} as const;

export type ApproverGroupErrorCode =
  (typeof ApproverGroupErrorCode)[keyof typeof ApproverGroupErrorCode];
