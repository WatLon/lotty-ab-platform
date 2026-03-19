import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import {
  AudiencePercent,
  ExperimentName,
  TargetingRule,
} from '@/apps/control-api/domain/experiment';

export const UpdateExperimentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(ExperimentName.MIN_LENGTH)
      .max(ExperimentName.MAX_LENGTH)
      .optional()
      .describe('Experiment name')
      .meta({ examples: ['Updated Name'] }),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Experiment description')
      .meta({ examples: ['Updated description'] }),
    audiencePercent: z
      .number()
      .int()
      .min(AudiencePercent.MIN_VALUE)
      .max(AudiencePercent.MAX_VALUE)
      .optional()
      .describe('Audience percent')
      .meta({ examples: [30] }),
    targetingRule: z
      .unknown()
      .nullable()
      .optional()
      .describe('Targeting rule DSL')
      .meta({
        examples: [
          {
            not: {
              attribute: 'country',
              op: 'eq',
              value: 'CN',
            },
          },
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
    if (data.targetingRule !== undefined) {
      const result = TargetingRule.create(data.targetingRule);
      if (result.isErr()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetingRule'],
          message: result.error.message,
        });
      }
    }

    if (data.metricIds !== undefined && new Set(data.metricIds).size !== data.metricIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metricIds'],
        message: 'metricIds must be unique',
      });
    }

    if (data.metricIds !== undefined && data.primaryMetricId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryMetricId'],
        message: 'primaryMetricId is required when metricIds are provided',
      });
    }

    if (
      data.metricIds !== undefined &&
      data.primaryMetricId !== null &&
      data.primaryMetricId !== undefined &&
      !data.metricIds.includes(data.primaryMetricId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryMetricId'],
        message: 'primaryMetricId must be one of metricIds',
      });
    }
  });

export class UpdateExperimentDto extends createZodDto(UpdateExperimentSchema) {}
