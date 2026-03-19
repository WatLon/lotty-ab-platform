import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { MetricErrorCode } from '@/apps/control-api/domain/metric';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

const schemas: Record<MetricErrorCode, SchemaObject> = {
  [MetricErrorCode.METRIC_KEY_ALREADY_EXISTS]: errorSchema(
    MetricErrorCode.METRIC_KEY_ALREADY_EXISTS,
    'Metric with key "conversion_rate" already exists',
    {
      key: { type: 'string', example: 'conversion_rate' },
    },
  ),
  [MetricErrorCode.METRIC_ARCHIVED]: errorSchema(
    MetricErrorCode.METRIC_ARCHIVED,
    'Metric "123e4567-e89b-12d3-a456-426614174000" is archived',
  ),
  [MetricErrorCode.METRIC_IN_USE_BY_ACTIVE_GUARDRAILS]: errorSchema(
    MetricErrorCode.METRIC_IN_USE_BY_ACTIVE_GUARDRAILS,
    'Metric "123e4567-e89b-12d3-a456-426614174000" is used by active guardrails',
  ),
};

SchemaRegistry.register(schemas);

export { MetricErrorCode };
