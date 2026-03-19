export interface CreateVariantInput {
  name: string;
  value: string;
  weight: number;
  isControl: boolean;
}

export interface CreateExperimentCommand {
  actorId: string;
  name: string;
  description: string | null;
  flagId: string;
  conflictDomain: string | null;
  priority: number | null;
  audiencePercent: number;
  targetingRule: unknown | null;
  variants: CreateVariantInput[];
  metricIds: string[];
  primaryMetricId: string | null;
}
