import { Injectable } from '@nestjs/common';
import { LearningEntryId } from '@/apps/control-api/domain/learning';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { LearningEntryOutput } from '../../learning-entry.output';
import { LearningEntryReadRepository } from '../../learning-entry.read-repository';
import { GetLearningEntryQuery } from './get-learning-entry.query';

@Injectable()
export class GetLearningEntryUseCase {
  constructor(private readonly readRepository: LearningEntryReadRepository) {}

  async execute(query: GetLearningEntryQuery): Promise<Result<LearningEntryOutput, NotFoundError>> {
    const entry = await this.readRepository.findById(query.id);
    if (!entry) return err(new NotFoundError('learningEntry', LearningEntryId.from(query.id)));

    return ok(entry);
  }
}
