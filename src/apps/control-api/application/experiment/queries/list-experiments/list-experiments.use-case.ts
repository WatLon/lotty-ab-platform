import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { ExperimentOutput } from '../../experiment.output';
import { ExperimentReadRepository } from '../../experiment.read-repository';
import { ListExperimentsQuery } from './list-experiments.query';

@Injectable()
export class ListExperimentsUseCase {
  constructor(private readonly experimentReadRepository: ExperimentReadRepository) {}

  async execute(
    query: ListExperimentsQuery,
  ): Promise<Result<PaginatedResult<ExperimentOutput>, never>> {
    const experiments = await this.experimentReadRepository.findAll({
      flagId: query.flagId,
      status: query.status,
      ownerId: query.ownerId,
      limit: query.limit,
      offset: query.offset,
    });
    return ok(experiments);
  }
}
