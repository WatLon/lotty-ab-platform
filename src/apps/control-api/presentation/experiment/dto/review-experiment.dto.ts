import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

export const ApproveExperimentSchema = z.object({
  comment: z
    .string()
    .nullable()
    .optional()
    .describe('Optional review comment')
    .meta({ examples: ['Looks good, metrics and targeting are correct'] }),
});

export class ApproveExperimentDto extends createZodDto(ApproveExperimentSchema) {}

export const RejectExperimentSchema = z.object({
  comment: z
    .string()
    .describe('Rejection comment')
    .meta({ examples: ['Guardrail metrics are not configured'] }),
});

export class RejectExperimentDto extends createZodDto(RejectExperimentSchema) {}

export const RequestChangesSchema = z.object({
  comment: z
    .string()
    .describe('Requested changes comment')
    .meta({ examples: ['Please reduce audience percent to 10% for initial run'] }),
});

export class RequestChangesDto extends createZodDto(RequestChangesSchema) {}
