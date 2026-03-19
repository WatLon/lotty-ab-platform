import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { NotificationChannelType } from '@/apps/control-api/domain/notification';

export const CreateNotificationChannelSchema = z.object({
  name: z.string().trim().min(1).max(128),
  type: z.nativeEnum(NotificationChannelType),
  config: z.unknown(),
  isEnabled: z.boolean().optional(),
});

export class CreateNotificationChannelDto extends createZodDto(CreateNotificationChannelSchema) {}
