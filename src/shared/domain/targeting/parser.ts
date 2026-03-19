import { err, isPlainObject, ok, Result } from '@/shared/domain/common';
import { TargetingAstNode } from './ast';
import { TargetingParseError, TargetingParseErrorCode } from './errors';
import { DEFAULT_TARGETING_DSL_LIMITS, TargetingDslLimits } from './limits';
import { isOperator, Operator } from './operators';

interface ParseState {
  nodes: number;
}

export class TargetingRuleParser {
  constructor(private readonly limits: TargetingDslLimits = DEFAULT_TARGETING_DSL_LIMITS) {}

  parse(input: unknown): Result<TargetingAstNode, TargetingParseError> {
    const state: ParseState = { nodes: 0 };

    return this.parseNode(input, 1, state);
  }

  private parseNode(
    input: unknown,
    depth: number,
    state: ParseState,
  ): Result<TargetingAstNode, TargetingParseError> {
    if (depth > this.limits.maxDepth) {
      return err({ code: TargetingParseErrorCode.DEPTH_LIMIT_EXCEEDED });
    }

    if (!isPlainObject(input)) {
      return err({ code: TargetingParseErrorCode.INVALID_RULE });
    }
    state.nodes += 1;

    if (state.nodes > this.limits.maxNodes) {
      return err({ code: TargetingParseErrorCode.NODE_LIMIT_EXCEEDED });
    }

    const obj = input;
    const keys = Object.keys(obj);
    const hasAnd = this.hasOwn(obj, 'and');
    const hasOr = this.hasOwn(obj, 'or');
    const hasNot = this.hasOwn(obj, 'not');
    const hasConditionField =
      this.hasOwn(obj, 'attribute') || this.hasOwn(obj, 'op') || this.hasOwn(obj, 'value');
    const shapes = Number(hasAnd) + Number(hasOr) + Number(hasNot) + Number(hasConditionField);

    if (shapes === 0) {
      return err({ code: TargetingParseErrorCode.INVALID_RULE });
    }

    if (shapes !== 1) {
      return err({ code: TargetingParseErrorCode.MIXED_NODE_SHAPE });
    }

    if (hasAnd) {
      return this.parseGroup('and', obj.and, keys, depth, state);
    }

    if (hasOr) {
      return this.parseGroup('or', obj.or, keys, depth, state);
    }

    if (hasNot) {
      if (keys.length !== 1) {
        return err({ code: TargetingParseErrorCode.UNKNOWN_KEYS });
      }

      const parsedNot = this.parseNode(obj.not, depth + 1, state);

      if (parsedNot.isErr()) {
        return parsedNot;
      }

      return ok({ not: parsedNot.value });
    }

    return this.parseCondition(obj, keys);
  }

  private parseGroup(
    type: 'and' | 'or',
    value: unknown,
    keys: string[],
    depth: number,
    state: ParseState,
  ): Result<TargetingAstNode, TargetingParseError> {
    if (keys.length !== 1) {
      return err({ code: TargetingParseErrorCode.UNKNOWN_KEYS });
    }

    if (!Array.isArray(value)) {
      return err({ code: TargetingParseErrorCode.INVALID_RULE });
    }

    if (value.length === 0) {
      return err({ code: TargetingParseErrorCode.EMPTY_GROUP });
    }

    const rules: TargetingAstNode[] = [];

    for (const child of value) {
      const parsedChild = this.parseNode(child, depth + 1, state);

      if (parsedChild.isErr()) {
        return parsedChild;
      }
      rules.push(parsedChild.value);
    }

    return ok(type === 'and' ? { and: rules } : { or: rules });
  }

  private parseCondition(
    obj: Record<string, unknown>,
    keys: string[],
  ): Result<TargetingAstNode, TargetingParseError> {
    if (!this.hasOwn(obj, 'attribute') || !this.hasOwn(obj, 'op') || !this.hasOwn(obj, 'value')) {
      return err({ code: TargetingParseErrorCode.INVALID_RULE });
    }

    if (keys.length !== 3) {
      return err({ code: TargetingParseErrorCode.UNKNOWN_KEYS });
    }

    const rawAttribute = obj.attribute;
    const rawOp = obj.op;
    const value = obj.value;

    if (typeof rawAttribute !== 'string') {
      return err({ code: TargetingParseErrorCode.INVALID_ATTRIBUTE });
    }

    const attribute = rawAttribute.trim();

    if (attribute.length === 0) {
      return err({ code: TargetingParseErrorCode.INVALID_ATTRIBUTE });
    }

    if (typeof rawOp !== 'string' || !isOperator(rawOp)) {
      return err({ code: TargetingParseErrorCode.INVALID_OPERATOR });
    }

    const op: Operator = rawOp;

    if ((op === 'in' || op === 'not_in') && !Array.isArray(value)) {
      return err({ code: TargetingParseErrorCode.INVALID_IN_VALUE });
    }

    return ok({
      attribute,
      op,
      value,
    });
  }

  private hasOwn(obj: Record<string, unknown>, key: string): boolean {
    return Object.hasOwn(obj, key);
  }
}
