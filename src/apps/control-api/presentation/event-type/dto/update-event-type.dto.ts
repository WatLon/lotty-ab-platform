import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { EventTypeDescription, EventTypeName } from '@/apps/control-api/domain/event-type';
import { validateEventTypeSchemaDefinition } from '@/shared/domain/event-type-schema.validator';
export const UpdateEventTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(EventTypeName.MAX_LENGTH)
    .optional()
    .describe('Event type name')
    .meta({ examples: ['Updated Name'] }),
  description: z
    .string()
    .trim()
    .max(EventTypeDescription.MAX_LENGTH)
    .nullable()
    .optional()
    .describe('Event type description')
    .meta({ examples: ['Updated description'] }),
  schema: z
    .unknown()
    .superRefine((value, ctx) => {
      const validationError = validateEventTypeSchemaDefinition(value);
      if (validationError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid event schema: ${validationError}`,
        });
      }
    })
    .optional()
    .describe('Event schema')
    .meta({ examples: [{ type: 'object' }] }),
});

export class UpdateEventTypeDto extends createZodDto(UpdateEventTypeSchema) {}
