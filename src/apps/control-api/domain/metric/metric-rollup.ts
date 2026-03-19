export interface MetricStats {
  count: number;
  sum: number;
  percentiles: number[];
}

export type MetricRollup = ReadonlyMap<string, MetricStats>;

export type MetricRollupTimeline = ReadonlyMap<string, MetricRollup>;
