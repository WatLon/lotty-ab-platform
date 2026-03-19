import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { METRIC_ROLLUP_BUCKETS } from '@/apps/control-api/domain/metric';

function dateQuerySchema(field: 'from' | 'to') {
  return z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: `${field} must be a valid ISO datetime`,
    })
    .transform((value) => new Date(value));
}

export const GetExperimentReportQuerySchema = z
  .object({
    from: dateQuerySchema('from'),
    to: dateQuerySchema('to'),
    bucket: z.enum(METRIC_ROLLUP_BUCKETS).optional().default('minute'),
  })
  .refine((value) => value.from.getTime() < value.to.getTime(), {
    message: 'from must be earlier than to',
    path: ['from'],
  });

export class GetExperimentReportQueryDto extends createZodDto(GetExperimentReportQuerySchema) {}
