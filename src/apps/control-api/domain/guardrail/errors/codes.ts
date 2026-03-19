export const GuardrailErrorCode = {
  GUARDRAIL_RULE_ALREADY_EXISTS: 'GUARDRAIL_RULE_ALREADY_EXISTS',
} as const;

export type GuardrailErrorCode = (typeof GuardrailErrorCode)[keyof typeof GuardrailErrorCode];
