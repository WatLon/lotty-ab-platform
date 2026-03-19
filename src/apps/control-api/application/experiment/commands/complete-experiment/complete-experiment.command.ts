import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';

export interface CompleteExperimentCommand {
  actorId: string;
  experimentId: string;
  outcomeType: ExperimentOutcomeType;
  winnerVariantId: string | null;
  comment: string;
}
