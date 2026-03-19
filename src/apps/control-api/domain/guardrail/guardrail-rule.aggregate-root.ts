import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';
import { AggregateRoot, err, ok, Result, ValidationErrors } from '@/shared/domain/common';
import { TooLowError, ValidationError } from '@/shared/domain/common/errors';
import { GuardrailRuleId } from './guardrail-rule.id';

export interface GuardrailRuleProps {
  experimentId: string;
  metricId: string;
  threshold: number;
  operator: ComparisonOperator;
  windowMinutes: number;
  action: GuardrailAction;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateGuardrailRuleProps {
  experimentId: string;
  metricId: string;
  threshold: number;
  operator: ComparisonOperator;
  windowMinutes: number;
  action: GuardrailAction;
}

export class GuardrailRule extends AggregateRoot<GuardrailRuleProps, GuardrailRuleId> {
  private constructor(props: GuardrailRuleProps, id: GuardrailRuleId) {
    super(props, id);
  }

  static create(props: CreateGuardrailRuleProps): Result<GuardrailRule, ValidationErrors> {
    const errors = [
      ...GuardrailRule.validateThresholdAndWindow(props.threshold, props.windowMinutes),
    ];
    if (errors.length > 0) {
      return err(new ValidationErrors(errors));
    }
    return ok(
      new GuardrailRule(
        {
          ...props,
          createdAt: new Date(),
          updatedAt: null,
        },
        GuardrailRuleId.generate(),
      ),
    );
  }

  static reconstitute(props: GuardrailRuleProps, id: GuardrailRuleId): GuardrailRule {
    return new GuardrailRule(props, id);
  }

  get experimentId(): string {
    return this.props.experimentId;
  }

  get metricId(): string {
    return this.props.metricId;
  }

  get threshold(): number {
    return this.props.threshold;
  }

  get operator(): ComparisonOperator {
    return this.props.operator;
  }

  get windowMinutes(): number {
    return this.props.windowMinutes;
  }

  get action(): GuardrailAction {
    return this.props.action;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  updateMetricId(metricId: string): void {
    if (metricId === this.props.metricId) return;

    this.props.metricId = metricId;
    this.touch();
  }

  updateThreshold(threshold: number): Result<void, ValidationErrors> {
    const errors = GuardrailRule.validateThresholdAndWindow(threshold, this.props.windowMinutes);
    if (errors.length > 0) return err(new ValidationErrors(errors));
    if (threshold === this.props.threshold) return ok(undefined);

    this.props.threshold = threshold;
    this.touch();
    return ok(undefined);
  }

  updateOperator(operator: ComparisonOperator): void {
    if (operator === this.props.operator) return;

    this.props.operator = operator;
    this.touch();
  }

  updateWindowMinutes(windowMinutes: number): Result<void, ValidationErrors> {
    const errors = GuardrailRule.validateThresholdAndWindow(this.props.threshold, windowMinutes);
    if (errors.length > 0) return err(new ValidationErrors(errors));
    if (windowMinutes === this.props.windowMinutes) return ok(undefined);

    this.props.windowMinutes = windowMinutes;
    this.touch();
    return ok(undefined);
  }

  updateAction(action: GuardrailAction): void {
    if (action === this.props.action) return;

    this.props.action = action;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static validateThresholdAndWindow(
    threshold: number,
    windowMinutes: number,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    if (threshold < 0) {
      errors.push(new TooLowError('threshold', 0, threshold));
    }
    if (windowMinutes < 1) {
      errors.push(new TooLowError('windowMinutes', 1, windowMinutes));
    }
    return errors;
  }
}
