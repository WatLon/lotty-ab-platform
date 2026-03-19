import {
  ExperimentOutcomeType,
  ExperimentStatus,
  ReviewDecision,
} from '@/apps/control-api/domain/experiment';

export interface VariantOutput {
  id: string;
  name: string;
  value: string;
  weight: number;
  isControl: boolean;
}

export interface ReviewOutput {
  id: string;
  reviewerId: string;
  decision: ReviewDecision;
  comment: string | null;
  createdAt: Date;
}

export interface ExperimentOutcomeOutput {
  type: ExperimentOutcomeType;
  winnerVariantId: string | null;
  comment: string;
  decidedById: string;
  decidedAt: Date;
}

export interface ExperimentOutput {
  id: string;
  name: string;
  description: string | null;
  flagId: string;
  status: ExperimentStatus;
  conflictDomain: string | null;
  priority: number;
  audiencePercent: number;
  targetingRule: unknown;
  ownerId: string;
  variants: VariantOutput[];
  metricIds: string[];
  primaryMetricId: string | null;
  reviews: ReviewOutput[];
  outcome: ExperimentOutcomeOutput | null;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}
