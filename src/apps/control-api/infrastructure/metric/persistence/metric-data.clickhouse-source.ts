import { Injectable } from '@nestjs/common';
import {
  ceilMetricRollupDate,
  floorMetricRollupDate,
  MetricDataSource,
  MetricRollup,
  MetricRollupBucket,
  MetricRollupQuery,
  MetricRollupTimeline,
  MetricStats,
} from '@/apps/control-api/domain/metric';
import { ClickHouseService } from '@/shared/infrastructure/clickhouse/clickhouse.service';

interface RollupRow {
  variantId?: string;
  metricKey: string;
  count: string | number;
  sum: string | number;
  qs: number[];
}

interface RollupTimelineRow extends RollupRow {
  rollupBucketMs: string | number;
}

function toFiniteNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bucketExpression(bucket: MetricRollupBucket): string {
  return bucket === 'hour' ? "toDateTime64(toStartOfHour(bucket), 3, 'UTC')" : 'bucket';
}

function toBucketIso(value: unknown): string | null {
  const ms = toFiniteNumber(value);
  if (!Number.isFinite(ms)) return null;

  return new Date(ms).toISOString();
}

function buildBucketTimeline(from: Date, to: Date, bucket: MetricRollupBucket): string[] {
  const stepMs = bucket === 'hour' ? 3_600_000 : 60_000;
  const timeline: string[] = [];

  for (let current = from.getTime(); current < to.getTime(); current += stepMs) {
    timeline.push(new Date(current).toISOString());
  }

  return timeline;
}

@Injectable()
export class MetricDataClickHouseSource extends MetricDataSource {
  constructor(private readonly clickhouse: ClickHouseService) {
    super();
  }

  async readRollup(query: MetricRollupQuery, metricKeys: string[]): Promise<MetricRollup> {
    if (metricKeys.length === 0) return new Map();

    const rows = await this.queryRollup(query, metricKeys, false);
    const result = new Map<string, MetricStats>();

    for (const row of rows) {
      result.set(row.metricKey, this.toStats(row));
    }

    return result;
  }

  async readRollupByVariant(
    query: MetricRollupQuery,
    metricKeys: string[],
  ): Promise<Map<string, MetricRollup>> {
    if (metricKeys.length === 0) return new Map();

    const rows = await this.queryRollup(query, metricKeys, true);
    const result = new Map<string, Map<string, MetricStats>>();

    for (const row of rows) {
      const variantId = row.variantId ?? '';
      let variantMap = result.get(variantId);
      if (!variantMap) {
        variantMap = new Map();
        result.set(variantId, variantMap);
      }
      variantMap.set(row.metricKey, this.toStats(row));
    }

    return result;
  }

  async readRollupTimelineByVariant(
    query: MetricRollupQuery,
    metricKeys: string[],
  ): Promise<Map<string, MetricRollupTimeline>> {
    if (metricKeys.length === 0) return new Map();

    const rows = await this.queryRollupTimeline(query, metricKeys, true);
    const sparseResult = new Map<string, Map<string, Map<string, MetricStats>>>();

    for (const row of rows) {
      const variantId = row.variantId ?? '';
      const bucketIso = toBucketIso(row.rollupBucketMs);
      if (!bucketIso) continue;

      let timeline = sparseResult.get(variantId);
      if (!timeline) {
        timeline = new Map();
        sparseResult.set(variantId, timeline);
      }

      let rollup = timeline.get(bucketIso);
      if (!rollup) {
        rollup = new Map();
        timeline.set(bucketIso, rollup);
      }

      rollup.set(row.metricKey, this.toStats(row));
    }

    const bucketTimeline = buildBucketTimeline(query.from, query.to, query.bucket);
    const result = new Map<string, MetricRollupTimeline>();

    if (sparseResult.size === 0) {
      const emptyTimeline = new Map<string, MetricRollup>();
      for (const bucket of bucketTimeline) {
        emptyTimeline.set(bucket, new Map());
      }
      result.set('', emptyTimeline);
      return result;
    }

    for (const [variantId, timeline] of sparseResult.entries()) {
      const filledTimeline = new Map<string, MetricRollup>();
      for (const bucket of bucketTimeline) {
        filledTimeline.set(bucket, timeline.get(bucket) ?? new Map());
      }
      result.set(variantId, filledTimeline);
    }

    return result;
  }

  private async queryRollup(
    params: MetricRollupQuery,
    metricKeys: string[],
    groupByVariant: boolean,
  ): Promise<RollupRow[]> {
    const from = floorMetricRollupDate(params.from, params.bucket);
    const to = ceilMetricRollupDate(params.to, params.bucket);
    const rollupBucketExpr = bucketExpression(params.bucket);
    const groupByVariantPrefix = groupByVariant ? 'variantId, ' : '';
    const selectVariantColumn = groupByVariant ? 'variantId,' : '';

    return this.clickhouse.queryJson<RollupRow>({
      query: `
        SELECT
          ${selectVariantColumn}
          metricKey,
          countMerge(countState) AS count,
          sumMerge(sumState) AS sum,
          quantilesMerge(0.5, 0.9, 0.95, 0.99)(quantilesState) AS qs
        FROM (
          SELECT
            ${selectVariantColumn}
            metricKey,
            ${rollupBucketExpr} AS rollupBucket,
            countMergeState(countState) AS countState,
            sumMergeState(sumState) AS sumState,
            quantilesMergeState(0.5, 0.9, 0.95, 0.99)(quantilesState) AS quantilesState
          FROM metric_rollups_mv
          WHERE experimentId = {experimentId:String}
            AND metricKey IN {metricKeys:Array(String)}
            AND bucket >= parseDateTime64BestEffort({from:String})
            AND bucket < parseDateTime64BestEffort({to:String})
          GROUP BY ${groupByVariantPrefix}metricKey, rollupBucket
        )
        GROUP BY ${groupByVariantPrefix}metricKey
      `,
      query_params: {
        experimentId: params.experimentId,
        metricKeys,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  }

  private async queryRollupTimeline(
    params: MetricRollupQuery,
    metricKeys: string[],
    groupByVariant: boolean,
  ): Promise<RollupTimelineRow[]> {
    const from = floorMetricRollupDate(params.from, params.bucket);
    const to = ceilMetricRollupDate(params.to, params.bucket);
    const rollupBucketExpr = bucketExpression(params.bucket);
    const groupByVariantPrefix = groupByVariant ? 'variantId, ' : '';
    const selectVariantColumn = groupByVariant ? 'variantId,' : '';

    return this.clickhouse.queryJson<RollupTimelineRow>({
      query: `
        SELECT
          ${selectVariantColumn}
          metricKey,
          toUnixTimestamp64Milli(${rollupBucketExpr}) AS rollupBucketMs,
          countMerge(countState) AS count,
          sumMerge(sumState) AS sum,
          quantilesMerge(0.5, 0.9, 0.95, 0.99)(quantilesState) AS qs
        FROM metric_rollups_mv
        WHERE experimentId = {experimentId:String}
          AND metricKey IN {metricKeys:Array(String)}
          AND bucket >= parseDateTime64BestEffort({from:String})
          AND bucket < parseDateTime64BestEffort({to:String})
        GROUP BY ${groupByVariantPrefix}metricKey, ${rollupBucketExpr}
        ORDER BY ${groupByVariantPrefix}rollupBucketMs, metricKey
      `,
      query_params: {
        experimentId: params.experimentId,
        metricKeys,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  }

  private toStats(row: RollupRow): MetricStats {
    return {
      count: toFiniteNumber(row.count),
      sum: toFiniteNumber(row.sum),
      percentiles: Array.isArray(row.qs) ? row.qs.map(toFiniteNumber) : [],
    };
  }
}
