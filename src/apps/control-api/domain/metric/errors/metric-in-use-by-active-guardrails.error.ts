import { BusinessRuleError } from '@/shared/domain/common';
import { MetricId } from '../metric.id';
import { MetricErrorCode } from './codes';

export class MetricInUseByActiveGuardrailsError extends BusinessRuleError {
  readonly code = MetricErrorCode.METRIC_IN_USE_BY_ACTIVE_GUARDRAILS;

  constructor(metricId: MetricId) {
    super(`Metric "${metricId.value}" is used by active guardrails`);
  }
}
