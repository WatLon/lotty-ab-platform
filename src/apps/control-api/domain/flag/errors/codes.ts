export const FlagErrorCode = {
  FLAG_KEY_ALREADY_EXISTS: 'FLAG_KEY_ALREADY_EXISTS',
} as const;

export type FlagErrorCode = (typeof FlagErrorCode)[keyof typeof FlagErrorCode];
