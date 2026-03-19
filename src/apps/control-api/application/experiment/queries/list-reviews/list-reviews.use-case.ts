import { Injectable } from '@nestjs/common';
import { ExperimentId } from '@/apps/control-api/domain/experiment';
import { normalizePagination, PaginatedResult } from '@/shared/application/pagination';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { ReviewOutput } from '../../experiment.output';
import { ExperimentReadRepository } from '../../experiment.read-repository';
import { ListReviewsQuery } from './list-reviews.query';

@Injectable()
export class ListReviewsUseCase {
  constructor(private readonly experimentReadRepository: ExperimentReadRepository) {}

  async execute(
    query: ListReviewsQuery,
  ): Promise<Result<PaginatedResult<ReviewOutput>, NotFoundError>> {
    const experiment = await this.experimentReadRepository.findById(query.experimentId);
    if (!experiment) {
      return err(new NotFoundError('experiment', ExperimentId.from(query.experimentId)));
    }

    const { limit, offset } = normalizePagination(query);
    const data = experiment.reviews.slice(offset, offset + limit);

    return ok({
      data,
      total: experiment.reviews.length,
      limit,
      offset,
    });
  }
}
