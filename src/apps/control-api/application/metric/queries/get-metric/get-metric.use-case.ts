import { Injectable } from '@nestjs/common';
import { MetricId } from '@/apps/control-api/domain/metric';
import { UserId, UserRepository } from '@/apps/control-api/domain/user';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { MetricOutput } from '../../metric.output';
import { MetricReadRepository } from '../../metric.read-repository';
import { GetMetricQuery } from './get-metric.query';

@Injectable()
export class GetMetricUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly metricReadRepository: MetricReadRepository,
  ) {}

  async execute(query: GetMetricQuery): Promise<Result<MetricOutput, NotFoundError>> {
    const actorId = UserId.from(query.actorId);
    const actor = await this.userRepository.findById(actorId);
    if (!actor) return err(new NotFoundError('user', actorId));

    const metric = await this.metricReadRepository.findById(query.metricId);
    if (!metric) return err(new NotFoundError('metric', MetricId.from(query.metricId)));

    return ok(metric);
  }
}
