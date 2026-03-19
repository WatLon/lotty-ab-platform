import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { ComparisonOperator, GuardrailAction } from '@/apps/control-api/domain/guardrail';
export const CreateGuardrailRuleSchema = z.object({
  metricId: z
    .string()
    .uuid()
    .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000'] }),
  threshold: z
    .number()
    .finite()
    .meta({ examples: [0.03] }),
  operator: z.nativeEnum(ComparisonOperator).meta({ examples: ['GT'] }),
  windowMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .meta({ examples: [10] }),
  action: z.nativeEnum(GuardrailAction).meta({ examples: ['PAUSE'] }),
});

export class CreateGuardrailRuleDto extends createZodDto(CreateGuardrailRuleSchema) {}
