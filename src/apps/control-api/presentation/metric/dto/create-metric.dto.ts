import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { MetricAggregation, MetricKey, MetricName } from '@/apps/control-api/domain/metric';

const CountFormulaSchema = z.object({
  type: z.literal(MetricAggregation.COUNT),
  eventTypeKey: z.string().trim().min(1),
});

const RatioFormulaSchema = z
  .object({
    type: z.literal(MetricAggregation.RATIO),
    numeratorEventTypeKey: z.string().trim().min(1),
    denominatorEventTypeKey: z.string().trim().min(1),
  })
  .refine((value) => value.numeratorEventTypeKey !== value.denominatorEventTypeKey, {
    message: 'numeratorEventTypeKey and denominatorEventTypeKey must be different',
    path: ['denominatorEventTypeKey'],
  });

const AverageFormulaSchema = z.object({
  type: z.literal(MetricAggregation.AVERAGE),
  eventTypeKey: z.string().trim().min(1),
  payloadField: z.string().trim().min(1),
});

const PercentileFormulaSchema = z.object({
  type: z.literal(MetricAggregation.PERCENTILE),
  eventTypeKey: z.string().trim().min(1),
  payloadField: z.string().trim().min(1),
  percentileValue: z.number().gt(0).lte(1),
});

const MetricFormulaSchema = z.discriminatedUnion('type', [
  CountFormulaSchema,
  RatioFormulaSchema,
  AverageFormulaSchema,
  PercentileFormulaSchema,
]);

export const CreateMetricSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(MetricKey.MAX_LENGTH)
    .regex(MetricKey.FORMAT)
    .meta({ examples: ['conversion_rate'] }),
  name: z
    .string()
    .trim()
    .min(1)
    .max(MetricName.MAX_LENGTH)
    .meta({ examples: ['Conversion Rate'] }),
  description: z.string().nullable().optional(),
  formula: MetricFormulaSchema.meta({
    examples: [
      { type: 'RATIO', numeratorEventTypeKey: 'purchase', denominatorEventTypeKey: 'exposure' },
    ],
  }),
});

export class CreateMetricDto extends createZodDto(CreateMetricSchema) {}
