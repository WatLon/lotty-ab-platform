import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { NotificationScopeType } from '@/apps/control-api/domain/notification';

const NotificationTargetSchema = z.object({
  channelId: z.string().uuid(),
  address: z.string().trim().min(1).nullable().optional(),
});
export const UpdateNotificationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    event: z.string().trim().min(1).optional(),
    scopeType: z.nativeEnum(NotificationScopeType).optional(),
    scopeValue: z.string().trim().min(1).nullable().optional(),
    metricKey: z.string().trim().min(1).nullable().optional(),
    severity: z.string().trim().min(1).nullable().optional(),
    environment: z.string().trim().min(1).nullable().optional(),
    rateLimitCount: z.number().int().min(1).optional(),
    rateLimitWindowSec: z.number().int().min(1).optional(),
    dedupeWindowSec: z.number().int().min(1).optional(),
    messageTemplate: z.string().trim().min(1).nullable().optional(),
    isEnabled: z.boolean().optional(),
    targets: z.array(NotificationTargetSchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export class UpdateNotificationRuleDto extends createZodDto(UpdateNotificationRuleSchema) {}
