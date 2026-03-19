export const UserErrorCode = {
  USER_EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',
  USER_CANNOT_CHANGE_OWN_ROLE: 'USER_CANNOT_CHANGE_OWN_ROLE',
  USER_CANNOT_DELETE_SELF: 'USER_CANNOT_DELETE_SELF',
} as const;

export type UserErrorCode = (typeof UserErrorCode)[keyof typeof UserErrorCode];
