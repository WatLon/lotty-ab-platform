import { Injectable } from '@nestjs/common';
import {
  ExperimentOutput,
  ExperimentReadRepository,
} from '@/apps/control-api/application/experiment';
import { MetricOutput, MetricReadRepository } from '@/apps/control-api/application/metric';
import { ExperimentId } from '@/apps/control-api/domain/experiment';
import {
  MetricDataSource,
  MetricFormula,
  MetricFormulaData,
  MetricFormulaEvaluator,
  MetricRollupBucket,
} from '@/apps/control-api/domain/metric';
import { AppLogger } from '@/shared/application';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { GetExperimentReportQuery } from './get-experiment-report.query';

export interface MetricValuePoint {
  bucket: string;
  value: number | null;
}

export interface VariantMetricReportItem {
  metricKey: string;
  metricName: string;
  isPrimary: boolean;
  value: number | null;
  points: MetricValuePoint[];
}

export interface VariantReportItem {
  variantId: string;
  metrics: VariantMetricReportItem[];
}

export interface ExperimentReportOutput {
  experimentId: string;
  from: string;
  to: string;
  bucket: MetricRollupBucket;
  variants: VariantReportItem[];
}

type ParsedMetricDefinition = {
  metricId: string;
  metricKey: string;
  metricName: string;
  isPrimary: boolean;
  formula: MetricFormulaData;
};

@Injectable()
export class GetExperimentReportUseCase {
  private static readonly OPERATION = 'GetExperimentReportUseCase.execute';

  constructor(
    private readonly experimentReadRepository: ExperimentReadRepository,
    private readonly metricReadRepository: MetricReadRepository,
    private readonly metricDataSource: MetricDataSource,
    private readonly appLogger: AppLogger,
  ) {}

  async execute(
    query: GetExperimentReportQuery,
  ): Promise<Result<ExperimentReportOutput, NotFoundError>> {
    const experiment = await this.experimentReadRepository.findById(query.experimentId);
    if (!experiment) {
      return err(new NotFoundError('experiment', ExperimentId.from(query.experimentId)));
    }

    if (experiment.metricIds.length === 0) {
      return ok(this.buildReportOutput(query, this.buildEmptyVariantReports(experiment)));
    }

    const parsedMetricDefinitions = await this.loadParsedMetricDefinitions(query, experiment);
    if (parsedMetricDefinitions.length === 0) {
      return ok(this.buildReportOutput(query, this.buildEmptyVariantReports(experiment)));
    }

    const metricKeys = MetricFormulaEvaluator.collectMetricKeys(
      parsedMetricDefinitions.map((metric) => metric.formula),
    );
    if (metricKeys.length === 0) {
      return ok(this.buildReportOutput(query, this.buildEmptyVariantReports(experiment)));
    }

    const [rollupByVariant, timelineByVariant] = await Promise.all([
      this.metricDataSource.readRollupByVariant(
        {
          experimentId: query.experimentId,
          from: query.from,
          to: query.to,
          bucket: query.bucket,
        },
        metricKeys,
      ),
      this.metricDataSource.readRollupTimelineByVariant(
        {
          experimentId: query.experimentId,
          from: query.from,
          to: query.to,
          bucket: query.bucket,
        },
        metricKeys,
      ),
    ]);

    const variants = this.buildVariantReports(
      experiment,
      parsedMetricDefinitions,
      rollupByVariant,
      timelineByVariant,
    );

    return ok(this.buildReportOutput(query, variants));
  }

  private buildReportOutput(
    query: GetExperimentReportQuery,
    variants: VariantReportItem[],
  ): ExperimentReportOutput {
    return {
      experimentId: query.experimentId,
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      bucket: query.bucket,
      variants,
    };
  }

  private buildEmptyVariantReports(experiment: ExperimentOutput): VariantReportItem[] {
    return experiment.variants.map((variant) => ({ variantId: variant.id, metrics: [] }));
  }

  private async loadParsedMetricDefinitions(
    query: GetExperimentReportQuery,
    experiment: ExperimentOutput,
  ): Promise<ParsedMetricDefinition[]> {
    const metricOutputs = await this.metricReadRepository.findByIds([...experiment.metricIds]);
    const parsedMetricDefinitions: ParsedMetricDefinition[] = [];

    for (const metric of metricOutputs) {
      const parsedMetricDefinition = this.parseMetricDefinition(
        query.experimentId,
        metric,
        experiment.primaryMetricId,
      );
      if (parsedMetricDefinition) {
        parsedMetricDefinitions.push(parsedMetricDefinition);
      }
    }

    return parsedMetricDefinitions;
  }

  private parseMetricDefinition(
    experimentId: string,
    metric: MetricOutput | null,
    primaryMetricId: string | null,
  ): ParsedMetricDefinition | null {
    if (!metric) {
      return null;
    }

    const formulaResult = MetricFormula.create(metric.formula);
    if (formulaResult.isErr()) {
      this.appLogger.warn({
        event: 'system.reporting.metric.formula.invalid',
        domain: 'system',
        operation: GetExperimentReportUseCase.OPERATION,
        status: 'failure',
        meta: {
          experimentId,
          metricId: metric.id,
          reason: formulaResult.error.message,
        },
      });
      return null;
    }

    return {
      metricId: metric.id,
      metricKey: metric.key,
      metricName: metric.name,
      isPrimary: metric.id === primaryMetricId,
      formula: formulaResult.value.data,
    };
  }

  private buildVariantReports(
    experiment: ExperimentOutput,
    parsedMetricDefinitions: ParsedMetricDefinition[],
    rollupByVariant: Map<
      string,
      ReadonlyMap<string, { count: number; sum: number; percentiles: number[] }>
    >,
    timelineByVariant: Map<
      string,
      ReadonlyMap<
        string,
        ReadonlyMap<string, { count: number; sum: number; percentiles: number[] }>
      >
    >,
  ): VariantReportItem[] {
    const fallbackTimelineTemplate = timelineByVariant.values().next().value;
    const emptyTimelineForMissingVariant = (): Map<
      string,
      Map<string, { count: number; sum: number; percentiles: number[] }>
    > => {
      if (!fallbackTimelineTemplate) return new Map();

      const emptyTimeline = new Map<
        string,
        Map<string, { count: number; sum: number; percentiles: number[] }>
      >();
      for (const bucket of fallbackTimelineTemplate.keys()) {
        emptyTimeline.set(bucket, new Map());
      }
      return emptyTimeline;
    };

    return experiment.variants.map((variant) => {
      const variantRollup = rollupByVariant.get(variant.id) ?? new Map();
      const variantTimeline = timelineByVariant.get(variant.id) ?? emptyTimelineForMissingVariant();

      return {
        variantId: variant.id,
        metrics: parsedMetricDefinitions.map((metricDefinition) =>
          this.buildVariantMetricItem(metricDefinition, variantRollup, variantTimeline),
        ),
      };
    });
  }

  private buildVariantMetricItem(
    metricDefinition: ParsedMetricDefinition,
    variantRollup: ReadonlyMap<string, { count: number; sum: number; percentiles: number[] }>,
    variantTimeline: ReadonlyMap<
      string,
      ReadonlyMap<string, { count: number; sum: number; percentiles: number[] }>
    >,
  ): VariantMetricReportItem {
    return {
      metricKey: metricDefinition.metricKey,
      metricName: metricDefinition.metricName,
      isPrimary: metricDefinition.isPrimary,
      value: MetricFormulaEvaluator.evaluate(metricDefinition.formula, variantRollup),
      points: Array.from(variantTimeline.entries()).map(([bucket, rollup]) => ({
        bucket,
        value: MetricFormulaEvaluator.evaluate(metricDefinition.formula, rollup),
      })),
    };
  }
}
