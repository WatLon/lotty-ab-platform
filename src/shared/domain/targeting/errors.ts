export const TargetingParseErrorCode = {
  INVALID_RULE: 'INVALID_RULE',
  MIXED_NODE_SHAPE: 'MIXED_NODE_SHAPE',
  UNKNOWN_KEYS: 'UNKNOWN_KEYS',
  EMPTY_GROUP: 'EMPTY_GROUP',
  INVALID_OPERATOR: 'INVALID_OPERATOR',
  INVALID_ATTRIBUTE: 'INVALID_ATTRIBUTE',
  INVALID_IN_VALUE: 'INVALID_IN_VALUE',
  DEPTH_LIMIT_EXCEEDED: 'DEPTH_LIMIT_EXCEEDED',
  NODE_LIMIT_EXCEEDED: 'NODE_LIMIT_EXCEEDED',
} as const;

export type TargetingParseErrorCode =
  (typeof TargetingParseErrorCode)[keyof typeof TargetingParseErrorCode];

export interface TargetingParseError {
  code: TargetingParseErrorCode;
}
