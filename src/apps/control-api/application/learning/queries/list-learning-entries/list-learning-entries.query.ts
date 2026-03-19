import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';

export interface ListLearningEntriesQuery {
  limit?: number;
  offset?: number;
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
