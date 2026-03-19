import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { RequiredApprovals } from '@/apps/control-api/domain/approver-group';

export const CreateApproverGroupSchema = z.object({
  ownerId: z
    .string()
    .uuid()
    .describe('Owner user ID')
    .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000'] }),
  requiredApprovals: z
    .number()
    .int()
    .min(RequiredApprovals.MIN_VALUE)
    .max(RequiredApprovals.MAX_VALUE)
    .describe('Number of required approvals')
    .meta({ examples: [2] }),
});

export class CreateApproverGroupDto extends createZodDto(CreateApproverGroupSchema) {}
