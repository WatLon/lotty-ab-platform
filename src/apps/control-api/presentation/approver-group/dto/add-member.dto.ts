import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

export const AddMemberSchema = z.object({
  userId: z
    .string()
    .uuid()
    .describe('Member user ID')
    .meta({ examples: ['123e4567-e89b-12d3-a456-426614174000'] }),
});

export class AddMemberDto extends createZodDto(AddMemberSchema) {}
