import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { NotificationDeliveryStatus } from '@/apps/control-api/domain/notification';

const OptionalIntegerQuerySchema = z
  .string()
  .regex(/^-?\d+$/, { message: 'must be an integer' })
  .transform((value) => Number.parseInt(value, 10))
  .optional();

export const ListNotificationDeliveriesQuerySchema = z.object({
  limit: OptionalIntegerQuerySchema,
  offset: OptionalIntegerQuerySchema,
  ruleId: z.string().optional(),
  status: z.nativeEnum(NotificationDeliveryStatus).optional(),
});

export class ListNotificationDeliveriesQueryDto extends createZodDto(
  ListNotificationDeliveriesQuerySchema,
) {}
