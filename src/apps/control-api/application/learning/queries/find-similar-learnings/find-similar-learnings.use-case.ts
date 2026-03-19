import { Injectable } from '@nestjs/common';
import { err, ok, Result, ValidationErrors } from '@/shared/domain/common';
import { RequiredError } from '@/shared/domain/common/errors/validation';
import { SimilarLearningOutput } from '../../learning-entry.output';
import { LearningEntryReadRepository } from '../../learning-entry.read-repository';
import { FindSimilarLearningsQuery } from './find-similar-learnings.query';

@Injectable()
export class FindSimilarLearningsUseCase {
  constructor(private readonly readRepository: LearningEntryReadRepository) {}

  async execute(
    query: FindSimilarLearningsQuery,
  ): Promise<Result<SimilarLearningOutput[], ValidationErrors>> {
    if (!query.learningId && !query.experimentId) {
      return err(new ValidationErrors([new RequiredError('learningId|experimentId')]));
    }

    return ok(
      await this.readRepository.findSimilar({
        learningId: query.learningId,
        experimentId: query.experimentId,
        limit: query.limit,
      }),
    );
  }
}
