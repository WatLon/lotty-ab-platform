import { ExperimentStatus } from '@/apps/control-api/domain/experiment';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ExperimentOutput } from './experiment.output';

export interface ListExperimentsParams {
  flagId?: string;
  status?: ExperimentStatus;
  ownerId?: string;
}

export abstract class ExperimentReadRepository {
  abstract findById(id: string): Promise<ExperimentOutput | null>;

  abstract findAll(
    params: ListExperimentsParams & PaginationParams,
  ): Promise<PaginatedResult<ExperimentOutput>>;
}
