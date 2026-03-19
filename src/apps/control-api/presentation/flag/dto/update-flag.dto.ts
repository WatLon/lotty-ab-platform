import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

export const UpdateFlagSchema = z.object({
  defaultValue: z
    .string()
    .describe('New default value (as string)')
    .meta({ examples: ['blue'] }),
  description: z
    .string()
    .nullable()
    .optional()
    .describe('Updated description')
    .meta({ examples: ['Updated description'] }),
});

export class UpdateFlagDto extends createZodDto(UpdateFlagSchema) {}
