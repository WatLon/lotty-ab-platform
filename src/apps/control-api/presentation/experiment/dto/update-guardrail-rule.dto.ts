import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';
export const UpdateGuardrailRuleSchema = z
  .object({
    metricId: z
      .string()
      .uuid()
      .optional()
      .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000'] }),
    threshold: z
      .number()
      .finite()
      .optional()
      .meta({ examples: [0.05] }),
    operator: z
      .nativeEnum(ComparisonOperator)
      .optional()
      .meta({ examples: ['GTE'] }),
    windowMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .optional()
      .meta({ examples: [30] }),
    action: z
      .nativeEnum(GuardrailAction)
      .optional()
      .meta({ examples: ['ROLLBACK'] }),
  })
  .refine(
    (value) =>
      value.metricId !== undefined ||
      value.threshold !== undefined ||
      value.operator !== undefined ||
      value.windowMinutes !== undefined ||
      value.action !== undefined,
    {
      message: 'At least one field must be provided',
    },
  );

export class UpdateGuardrailRuleDto extends createZodDto(UpdateGuardrailRuleSchema) {}
