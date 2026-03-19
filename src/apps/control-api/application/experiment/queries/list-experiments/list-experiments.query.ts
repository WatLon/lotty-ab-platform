import { ExperimentStatus } from '@/apps/control-api/domain/experiment';

export interface ListExperimentsQuery {
  flagId?: string;
  status?: ExperimentStatus;
  ownerId?: string;
  limit?: number;
  offset?: number;
}
