import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { GuardrailAction } from '@/apps/control-api/domain/guardrail';

const OptionalIntegerQuerySchema = z
  .string()
  .regex(/^-?\d+$/, { message: 'must be an integer' })
  .transform((value) => Number.parseInt(value, 10))
  .optional();

export const ListGuardrailTriggersQuerySchema = z.object({
  limit: OptionalIntegerQuerySchema,
  offset: OptionalIntegerQuerySchema,
  guardrailId: z.string().uuid().optional(),
  actionTaken: z.nativeEnum(GuardrailAction).optional(),
});

export class ListGuardrailTriggersQueryDto extends createZodDto(ListGuardrailTriggersQuerySchema) {}
