import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

export const UpdateNotificationChannelSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    config: z.unknown().optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export class UpdateNotificationChannelDto extends createZodDto(UpdateNotificationChannelSchema) {}
