import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';

export const CompleteExperimentSchema = z
  .object({
    outcomeType: z
      .nativeEnum(ExperimentOutcomeType)
      .describe('Outcome type')
      .meta({ examples: [ExperimentOutcomeType.ROLLOUT_WINNER] }),
    winnerVariantId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe('Winner variant ID')
      .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000'] }),
    comment: z
      .string()
      .trim()
      .min(1, 'comment is required')
      .describe('Completion comment')
      .meta({ examples: ['Variant B showed 15% improvement in conversion'] }),
  })
  .superRefine((data, ctx) => {
    if (data.outcomeType !== ExperimentOutcomeType.ROLLOUT_WINNER) return;
    if (data.winnerVariantId) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['winnerVariantId'],
      message: 'winnerVariantId is required when outcomeType is ROLLOUT_WINNER',
    });
  });

export class CompleteExperimentDto extends createZodDto(CompleteExperimentSchema) {}
