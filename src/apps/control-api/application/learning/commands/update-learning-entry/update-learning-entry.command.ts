import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';

export interface UpdateLearningEntryCommand {
  actorId: string;
  learningId: string;
  experimentId?: string | null;
  featureKey?: string | null;
  team?: string | null;
  title?: string;
  hypothesis?: string;
  primaryMetricKey?: string;
  guardrailMetricKeys?: string[];
  result?: ExperimentOutcomeType | null;
  actionTaken?: string;
  summary?: string;
  notes?: string | null;
  tags?: string[];
  countries?: string[];
  platforms?: string[];
  reportUrl?: string | null;
  ticketUrl?: string | null;
}
