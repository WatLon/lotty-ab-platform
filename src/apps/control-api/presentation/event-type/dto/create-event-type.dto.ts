import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import {
  EventTypeDescription,
  EventTypeKey,
  EventTypeName,
} from '@/apps/control-api/domain/event-type';
import { validateEventTypeSchemaDefinition } from '@/shared/domain/event-type-schema.validator';
export const CreateEventTypeSchema = z.object({
  key: z
    .string()
    .trim()
    .max(EventTypeKey.MAX_LENGTH)
    .regex(EventTypeKey.FORMAT)
    .describe('Unique event type key')
    .meta({ examples: ['button.clicked'] }),
  name: z
    .string()
    .trim()
    .min(1)
    .max(EventTypeName.MAX_LENGTH)
    .describe('Event type name')
    .meta({ examples: ['Button Clicked'] }),
  description: z
    .string()
    .trim()
    .max(EventTypeDescription.MAX_LENGTH)
    .nullable()
    .optional()
    .describe('Event type description')
    .meta({ examples: ['User clicked a button'] }),
  schema: z
    .unknown()
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (value === undefined) return;

      const validationError = validateEventTypeSchemaDefinition(value);
      if (validationError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid event schema: ${validationError}`,
        });
      }
    })
    .describe('Optional event schema')
    .meta({ examples: [{ type: 'object' }] }),
  requiresExposure: z
    .boolean()
    .describe('Whether exposure event is required for attribution')
    .meta({ examples: [true] }),
});

export class CreateEventTypeDto extends createZodDto(CreateEventTypeSchema) {}
