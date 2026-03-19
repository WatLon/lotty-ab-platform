export interface UpdateExperimentCommand {
  actorId: string;
  experimentId: string;
  name?: string;
  description?: string | null;
  audiencePercent?: number;
  targetingRule?: unknown;
  metricIds?: string[];
  primaryMetricId?: string | null;
}
