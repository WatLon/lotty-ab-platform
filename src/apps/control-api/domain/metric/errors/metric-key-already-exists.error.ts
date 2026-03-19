import { BusinessRuleError } from '@/shared/domain/common';
import { MetricKey } from '../value-objects/metric-key.vo';
import { MetricErrorCode } from './codes';

export class MetricKeyAlreadyExistsError extends BusinessRuleError {
  readonly code = MetricErrorCode.METRIC_KEY_ALREADY_EXISTS;

  constructor(key: MetricKey) {
    super(`Metric with key "${key.value}" already exists`);
  }
}
