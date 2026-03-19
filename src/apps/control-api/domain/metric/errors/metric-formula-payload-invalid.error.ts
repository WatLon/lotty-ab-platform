import { DomainError } from '@/shared/domain/common';

export class MetricFormulaPayloadInvalidError extends DomainError {
  readonly code = 'METRIC_FORMULA_PAYLOAD_INVALID';

  constructor(metricId: string, reason?: string) {
    const detail = reason ? `: ${reason}` : '';
    super(`Metric "${metricId}" has invalid formula payload${detail}`);
  }
}
