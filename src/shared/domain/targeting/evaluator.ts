import { TargetingAstNode, TargetingConditionNode } from './ast';

export class TargetingRuleEvaluator {
  evaluate(rule: TargetingAstNode, attributes: Record<string, unknown>): boolean {
    if ('and' in rule) {
      return rule.and.every((r) => this.evaluate(r, attributes));
    }

    if ('or' in rule) {
      return rule.or.some((r) => this.evaluate(r, attributes));
    }

    if ('not' in rule) {
      return !this.evaluate(rule.not, attributes);
    }

    return this.evaluateCondition(rule, attributes);
  }

  private evaluateCondition(
    condition: TargetingConditionNode,
    attributes: Record<string, unknown>,
  ): boolean {
    const attrValue = attributes[condition.attribute];

    if (attrValue === undefined) {
      return false;
    }

    const { op, value } = condition;

    switch (op) {
      case 'eq':
        return this.eq(attrValue, value);
      case 'neq':
        return !this.eq(attrValue, value);
      case 'in':
        return Array.isArray(value) && this.isIn(attrValue, value);
      case 'not_in':
        return Array.isArray(value) && !this.isIn(attrValue, value);
      case 'gt':
        return this.compare(attrValue, value, (a, b) => a > b);
      case 'gte':
        return this.compare(attrValue, value, (a, b) => a >= b);
      case 'lt':
        return this.compare(attrValue, value, (a, b) => a < b);
      case 'lte':
        return this.compare(attrValue, value, (a, b) => a <= b);
      default:
        return false;
    }
  }

  private eq(a: unknown, b: unknown): boolean {
    const aTime = this.toTimestamp(a);
    const bTime = this.toTimestamp(b);

    if (aTime !== null && bTime !== null) {
      return aTime === bTime;
    }

    return a === b;
  }

  private isIn(attrValue: unknown, list: unknown[]): boolean {
    const attrTime = this.toTimestamp(attrValue);

    if (attrTime !== null) {
      const anyComparable = list.some((v) => this.toTimestamp(v) !== null);

      if (anyComparable) {
        return list.some((v) => this.toTimestamp(v) === attrTime);
      }
    }

    return list.includes(attrValue);
  }

  private compare(
    attrValue: unknown,
    conditionValue: unknown,
    cmp: (a: number, b: number) => boolean,
  ): boolean {
    if (typeof attrValue === 'number' && typeof conditionValue === 'number') {
      return cmp(attrValue, conditionValue);
    }

    const aTime = this.toTimestamp(attrValue);
    const bTime = this.toTimestamp(conditionValue);

    if (aTime !== null && bTime !== null) {
      return cmp(aTime, bTime);
    }

    return false;
  }

  private toTimestamp(value: unknown): number | null {
    if (value instanceof Date) {
      const ms = value.getTime();

      return Number.isFinite(ms) ? ms : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value)) {
      return null;
    }

    const ms = Date.parse(value);

    return Number.isFinite(ms) ? ms : null;
  }
}
