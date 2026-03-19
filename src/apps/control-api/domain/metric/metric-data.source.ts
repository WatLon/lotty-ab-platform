import { MetricRollup, MetricRollupTimeline } from './metric-rollup';

export const METRIC_ROLLUP_BUCKETS = ['minute', 'hour'] as const;

export type MetricRollupBucket = (typeof METRIC_ROLLUP_BUCKETS)[number];

const BUCKET_MS: Record<MetricRollupBucket, number> = {
  minute: 60_000,
  hour: 3_600_000,
};

export function isMetricRollupBucket(value: string): value is MetricRollupBucket {
  return value === 'minute' || value === 'hour';
}

export function floorMetricRollupDate(date: Date, bucket: MetricRollupBucket): Date {
  const normalized = new Date(date);
  normalized.setUTCSeconds(0, 0);
  if (bucket === 'hour') {
    normalized.setUTCMinutes(0, 0, 0);
  }
  return normalized;
}

export function ceilMetricRollupDate(date: Date, bucket: MetricRollupBucket): Date {
  const floored = floorMetricRollupDate(date, bucket);
  if (floored.getTime() === date.getTime()) return floored;

  return new Date(floored.getTime() + BUCKET_MS[bucket]);
}

export interface MetricRollupQuery {
  experimentId: string;
  from: Date;
  to: Date;
  bucket: MetricRollupBucket;
}

export abstract class MetricDataSource {
  abstract readRollup(query: MetricRollupQuery, metricKeys: string[]): Promise<MetricRollup>;

  abstract readRollupByVariant(
    query: MetricRollupQuery,
    metricKeys: string[],
  ): Promise<Map<string, MetricRollup>>;

  abstract readRollupTimelineByVariant(
    query: MetricRollupQuery,
    metricKeys: string[],
  ): Promise<Map<string, MetricRollupTimeline>>;
}
