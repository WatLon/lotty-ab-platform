export interface UpdateMetricCommand {
  actorId: string;
  metricId: string;
  name?: string;
  description?: string | null;
}
