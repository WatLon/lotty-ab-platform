import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { RequiredApprovals } from '@/apps/control-api/domain/approver-group';

export const UpdateApproverGroupSchema = z.object({
  requiredApprovals: z
    .number()
    .int()
    .min(RequiredApprovals.MIN_VALUE)
    .max(RequiredApprovals.MAX_VALUE)
    .describe('New number of required approvals')
    .meta({ examples: [3] }),
});

export class UpdateApproverGroupDto extends createZodDto(UpdateApproverGroupSchema) {}
