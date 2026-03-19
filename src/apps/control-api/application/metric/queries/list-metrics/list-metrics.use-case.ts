import { Injectable } from '@nestjs/common';
import { UserId, UserRepository } from '@/apps/control-api/domain/user';
import { PaginatedResult } from '@/shared/application/pagination';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { MetricOutput } from '../../metric.output';
import { MetricReadRepository } from '../../metric.read-repository';
import { ListMetricsQuery } from './list-metrics.query';

@Injectable()
export class ListMetricsUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly metricReadRepository: MetricReadRepository,
  ) {}

  async execute(
    query: ListMetricsQuery,
  ): Promise<Result<PaginatedResult<MetricOutput>, NotFoundError>> {
    const actorId = UserId.from(query.actorId);
    const actor = await this.userRepository.findById(actorId);
    if (!actor) return err(new NotFoundError('user', actorId));

    const metrics = await this.metricReadRepository.findAll(
      { limit: query.limit, offset: query.offset },
      { includeArchived: query.includeArchived ?? false },
    );
    return ok(metrics);
  }
}
