import { MetricRollupBucket } from '@/apps/control-api/domain/metric';

export interface GetExperimentReportQuery {
  experimentId: string;
  from: Date;
  to: Date;
  bucket: MetricRollupBucket;
}
