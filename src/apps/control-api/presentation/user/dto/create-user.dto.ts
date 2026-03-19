import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { Role, UserEmail, UserName, UserPassword } from '@/apps/control-api/domain/user';

export const CreateUserSchema = z.object({
  email: z
    .string()
    .trim()
    .max(UserEmail.MAX_LENGTH)
    .regex(UserEmail.EMAIL_REGEX)
    .describe('User email address')
    .meta({ examples: ['user@example.com'] }),
  password: z
    .string()
    .min(UserPassword.MIN_LENGTH)
    .max(UserPassword.MAX_LENGTH)
    .describe('Plain-text password')
    .meta({ examples: ['SecurePass123'] }),
  name: z
    .string()
    .trim()
    .min(UserName.MIN_LENGTH)
    .max(UserName.MAX_LENGTH)
    .describe('User display name')
    .meta({ examples: ['John Doe'] }),
  role: z
    .nativeEnum(Role)
    .optional()
    .describe('User role')
    .meta({ examples: [Role.VIEWER] }),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
