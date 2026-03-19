import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';

export interface LearningRevisionOutput {
  id: string;
  revision: number;
  changedById: string;
  before: unknown;
  after: unknown;
  changedAt: Date;
}

export interface LearningEntryOutput {
  id: string;
  experimentId: string | null;
  featureKey: string | null;
  team: string | null;
  title: string;
  hypothesis: string;
  primaryMetricKey: string;
  guardrailMetricKeys: string[];
  result: ExperimentOutcomeType | null;
  actionTaken: string;
  summary: string;
  notes: string | null;
  tags: string[];
  countries: string[];
  platforms: string[];
  reportUrl: string | null;
  ticketUrl: string | null;
  createdById: string;
  updatedById: string | null;
  isArchived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  revisions?: LearningRevisionOutput[];
}

export interface SimilarLearningOutput {
  learning: LearningEntryOutput;
  score: number;
  reasons: string[];
}
