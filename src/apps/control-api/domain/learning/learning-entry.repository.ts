import { ConcurrencyError, Result } from '@/shared/domain/common';
import { LearningEntry } from './learning-entry.aggregate-root';
import { LearningEntryId } from './learning-entry.id';

export abstract class LearningEntryRepository {
  abstract findById(id: LearningEntryId): Promise<LearningEntry | null>;

  abstract save(entry: LearningEntry): Promise<Result<void, ConcurrencyError>>;
}
