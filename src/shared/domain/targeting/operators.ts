export const TARGETING_OPERATORS = ['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte'] as const;

export type Operator = (typeof TARGETING_OPERATORS)[number];

export function isOperator(value: string): value is Operator {
  return TARGETING_OPERATORS.some((op) => op === value);
}
