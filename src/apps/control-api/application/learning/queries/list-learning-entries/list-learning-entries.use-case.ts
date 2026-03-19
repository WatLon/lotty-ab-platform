import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { LearningEntryOutput } from '../../learning-entry.output';
import { LearningEntryReadRepository } from '../../learning-entry.read-repository';
import { ListLearningEntriesQuery } from './list-learning-entries.query';

@Injectable()
export class ListLearningEntriesUseCase {
  constructor(private readonly readRepository: LearningEntryReadRepository) {}

  async execute(
    query: ListLearningEntriesQuery,
  ): Promise<Result<PaginatedResult<LearningEntryOutput>, never>> {
    return ok(
      await this.readRepository.findAll(
        { limit: query.limit, offset: query.offset },
        {
          q: query.q,
          experimentId: query.experimentId,
          featureKey: query.featureKey,
          team: query.team,
          result: query.result,
          countries: query.countries,
          platforms: query.platforms,
          includeArchived: query.includeArchived,
          createdFrom: query.createdFrom,
          createdTo: query.createdTo,
        },
      ),
    );
  }
}
