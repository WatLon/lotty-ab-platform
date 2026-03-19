export const ValidationErrorCode = {
  REQUIRED: 'REQUIRED',
  TOO_LONG: 'TOO_LONG',
  TOO_SHORT: 'TOO_SHORT',
  TOO_HIGH: 'TOO_HIGH',
  TOO_LOW: 'TOO_LOW',
  INVALID_FORMAT: 'INVALID_FORMAT',
} as const;

export type ValidationErrorCode = (typeof ValidationErrorCode)[keyof typeof ValidationErrorCode];
