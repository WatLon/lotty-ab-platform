import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { UserName } from '@/apps/control-api/domain/user';

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(UserName.MIN_LENGTH)
    .max(UserName.MAX_LENGTH)
    .describe('New user display name')
    .meta({ examples: ['Jane Doe'] }),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
