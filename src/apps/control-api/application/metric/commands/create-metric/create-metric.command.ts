export interface CreateMetricCommand {
  actorId: string;
  key: string;
  name: string;
  description: string | null;
  formula: unknown;
}
