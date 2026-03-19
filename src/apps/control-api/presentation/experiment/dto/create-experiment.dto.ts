import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import {
  AudiencePercent,
  ExperimentName,
  TargetingRule,
  VariantName,
  VariantValue,
  VariantWeight,
} from '@/apps/control-api/domain/experiment';

export const CreateVariantSchema = z.object({
  name: z
    .string()
    .trim()
    .max(VariantName.MAX_LENGTH)
    .describe('Variant name')
    .meta({ examples: ['Control'] }),
  value: z
    .string()
    .max(VariantValue.MAX_LENGTH)
    .describe('Variant value')
    .meta({ examples: ['A'] }),
  weight: z
    .number()
    .int()
    .min(VariantWeight.MIN_VALUE)
    .max(VariantWeight.MAX_VALUE)
    .describe('Variant weight')
    .meta({ examples: [50] }),
  isControl: z
    .boolean()
    .describe('Whether this is the control variant')
    .meta({ examples: [true] }),
});

export class CreateVariantDto extends createZodDto(CreateVariantSchema) {}

export const CreateExperimentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(ExperimentName.MIN_LENGTH)
      .max(ExperimentName.MAX_LENGTH)
      .describe('Experiment name')
      .meta({ examples: ['Button Color Test'] }),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Experiment description')
      .meta({ examples: ['Testing different button colors'] }),
    flagId: z
      .string()
      .uuid()
      .describe('Flag ID')
      .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000'] }),
    conflictDomain: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .nullable()
      .optional()
      .describe(
        'Conflict domain. Experiments with the same non-null conflictDomain are mutually exclusive.',
      )
      .meta({ examples: ['checkout', null] }),
    priority: z
      .number()
      .int()
      .min(0)
      .max(1000)
      .optional()
      .describe('Experiment priority for conflict resolution. Higher wins.')
      .meta({ examples: [0, 10] }),
    audiencePercent: z
      .number()
      .int()
      .min(AudiencePercent.MIN_VALUE)
      .max(AudiencePercent.MAX_VALUE)
      .describe('Audience percent')
      .meta({ examples: [100] }),
    targetingRule: z
      .unknown()
      .nullable()
      .optional()
      .describe('Targeting rule DSL')
      .meta({
        examples: [
          {
            and: [
              { attribute: 'country', op: 'in', value: ['RU', 'KZ'] },
              {
                or: [
                  { attribute: 'age', op: 'gte', value: 18 },
                  { not: { attribute: 'segment', op: 'eq', value: 'blocked' } },
                ],
              },
            ],
          },
        ],
      }),
    variants: z
      .array(CreateVariantSchema)
      .describe('Variants')
      .meta({
        examples: [
          [
            { name: 'Control', value: 'A', weight: 50, isControl: true },
            { name: 'Treatment', value: 'B', weight: 50, isControl: false },
          ],
        ],
      }),
    metricIds: z
      .array(z.string().uuid())
      .optional()
      .describe('Attached metric IDs')
      .meta({ examples: [['123e4567-e89b-12d3-a456-426614174000']] }),
    primaryMetricId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe('Primary metric ID')
      .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000', null] }),
  })
  .superRefine((data, ctx) => {
    const result = TargetingRule.create(data.targetingRule ?? null);
    if (result.isErr()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetingRule'],
        message: result.error.message,
      });
    }

    const metricIds = data.metricIds ?? [];
    if (new Set(metricIds).size !== metricIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metricIds'],
        message: 'metricIds must be unique',
      });
    }

    if (metricIds.length > 0 && !data.primaryMetricId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryMetricId'],
        message: 'primaryMetricId is required when metricIds are provided',
      });
    }

    if (data.primaryMetricId && !metricIds.includes(data.primaryMetricId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryMetricId'],
        message: 'primaryMetricId must be one of metricIds',
      });
    }
  });

export class CreateExperimentDto extends createZodDto(CreateExperimentSchema) {}
