import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { UserEmail, UserPassword } from '@/apps/control-api/domain/user';

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(UserEmail.MAX_LENGTH)
    .regex(UserEmail.EMAIL_REGEX)
    .describe('User email address')
    .meta({ examples: ['admin@example.com'] }),
  password: z
    .string()
    .min(UserPassword.MIN_LENGTH)
    .max(UserPassword.MAX_LENGTH)
    .describe('Plain-text password')
    .meta({ examples: ['SecurePass123'] }),
});

export class LoginDto extends createZodDto(LoginSchema) {}
