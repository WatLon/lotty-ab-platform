import { ComparisonOperator } from './enums/comparison-operator.enum';

export function isGuardrailThresholdBreached(
  value: number,
  threshold: number,
  operator: ComparisonOperator,
): boolean {
  switch (operator) {
    case 'GT':
      return value > threshold;
    case 'GTE':
      return value >= threshold;
    case 'LT':
      return value < threshold;
    case 'LTE':
      return value <= threshold;
    default:
      return false;
  }
}
