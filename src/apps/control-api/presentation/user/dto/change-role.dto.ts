import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { Role } from '@/apps/control-api/domain/user';

export const ChangeRoleSchema = z.object({
  role: z
    .nativeEnum(Role)
    .describe('New user role')
    .meta({ examples: [Role.EXPERIMENTER] }),
});

export class ChangeRoleDto extends createZodDto(ChangeRoleSchema) {}
