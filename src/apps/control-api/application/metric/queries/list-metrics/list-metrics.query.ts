export interface ListMetricsQuery {
  actorId: string;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}
