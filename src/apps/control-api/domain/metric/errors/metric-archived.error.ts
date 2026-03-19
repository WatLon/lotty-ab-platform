import { BusinessRuleError } from '@/shared/domain/common';
import { MetricId } from '../metric.id';
import { MetricErrorCode } from './codes';

export class MetricArchivedError extends BusinessRuleError {
  readonly code = MetricErrorCode.METRIC_ARCHIVED;

  constructor(metricId: MetricId) {
    super(`Metric "${metricId.value}" is archived`);
  }
}
