import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError } from '@/shared/domain/common/errors';
import {
  TargetingAstNode,
  TargetingRuleEvaluator,
  TargetingRuleParser,
} from '@/shared/domain/targeting';

interface TargetingRuleProps {
  ast: TargetingAstNode | null;
  raw: unknown | null;
}

export class TargetingRule extends ValueObject<TargetingRuleProps> {
  private static readonly parser = new TargetingRuleParser();
  private static readonly evaluator = new TargetingRuleEvaluator();
  private constructor(props: TargetingRuleProps) {
    super(props);
  }

  static create(rule: unknown): Result<TargetingRule, InvalidFormatError> {
    if (rule === null || rule === undefined) {
      return ok(new TargetingRule({ ast: null, raw: null }));
    }

    const parsed = TargetingRule.parser.parse(rule);

    if (parsed.isErr()) {
      return err(new InvalidFormatError('targetingRule', 'valid targeting DSL'));
    }

    return ok(new TargetingRule({ ast: parsed.value, raw: null }));
  }

  static reconstitute(rule: unknown): TargetingRule {
    if (rule === null || rule === undefined) {
      return new TargetingRule({ ast: null, raw: null });
    }

    const parsed = TargetingRule.parser.parse(rule);

    return parsed.isOk()
      ? new TargetingRule({ ast: parsed.value, raw: null })
      : new TargetingRule({ ast: null, raw: rule });
  }

  get rule(): TargetingAstNode | null {
    return this.props.ast;
  }

  get isEmpty(): boolean {
    return this.props.ast === null && this.props.raw === null;
  }

  toJSON(): unknown {
    return this.props.ast ?? this.props.raw;
  }

  evaluate(attributes: Record<string, unknown>): boolean {
    if (this.isEmpty) {
      return true;
    }

    if (!this.props.ast) {
      return false;
    }

    return TargetingRule.evaluator.evaluate(this.props.ast, attributes);
  }
}
