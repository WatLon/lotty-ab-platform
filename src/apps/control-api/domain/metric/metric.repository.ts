import { ConcurrencyError, Result } from '@/shared/domain/common';
import { MetricKeyAlreadyExistsError } from './errors';
import { Metric } from './metric.aggregate-root';
import { MetricId } from './metric.id';
import { MetricKey } from './value-objects/metric-key.vo';

export abstract class MetricRepository {
  abstract findById(id: MetricId): Promise<Metric | null>;

  abstract findByIds(ids: MetricId[]): Promise<Metric[]>;

  abstract findByKey(key: MetricKey): Promise<Metric | null>;

  abstract findByKeys(keys: MetricKey[]): Promise<Metric[]>;

  abstract isUsedByActiveGuardrails(id: MetricId): Promise<boolean>;

  abstract save(
    entity: Metric,
  ): Promise<Result<void, ConcurrencyError | MetricKeyAlreadyExistsError>>;
}
