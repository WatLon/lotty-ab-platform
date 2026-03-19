import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { MetricName } from '@/apps/control-api/domain/metric';

export const UpdateMetricSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(MetricName.MAX_LENGTH)
      .optional()
      .meta({ examples: ['Checkout Conversion Rate'] }),
    description: z
      .string()
      .nullable()
      .optional()
      .meta({ examples: ['Updated metric description'] }),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'At least one field must be provided',
  });

export class UpdateMetricDto extends createZodDto(UpdateMetricSchema) {}
