import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { LearningEntryOutput, SimilarLearningOutput } from './learning-entry.output';

export interface LearningEntryFilters {
  q?: string;
  experimentId?: string;
  featureKey?: string;
  team?: string;
  result?: ExperimentOutcomeType;
  countries?: string[];
  platforms?: string[];
  includeArchived?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface FindSimilarLearningsCriteria {
  learningId?: string;
  experimentId?: string;
  limit?: number;
}

export abstract class LearningEntryReadRepository {
  abstract findById(id: string): Promise<LearningEntryOutput | null>;

  abstract findAll(
    params: PaginationParams,
    filters: LearningEntryFilters,
  ): Promise<PaginatedResult<LearningEntryOutput>>;

  abstract findSimilar(criteria: FindSimilarLearningsCriteria): Promise<SimilarLearningOutput[]>;
}
