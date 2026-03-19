import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { MetricOutput } from './metric.output';

export interface MetricReadOptions {
  includeArchived?: boolean;
}

export abstract class MetricReadRepository {
  abstract findById(id: string): Promise<MetricOutput | null>;

  abstract findByIds(ids: string[]): Promise<MetricOutput[]>;

  abstract findAll(
    params: PaginationParams,
    options?: MetricReadOptions,
  ): Promise<PaginatedResult<MetricOutput>>;
}
