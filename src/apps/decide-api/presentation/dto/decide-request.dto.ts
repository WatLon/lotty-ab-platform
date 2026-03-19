import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import {
  FLAG_KEY_FORMAT,
  FLAG_KEY_MAX_LENGTH,
  FLAG_KEY_MIN_LENGTH,
} from '@/contracts/decision-runtime';
export const DecideRequestSchema = z.object({
  subjectId: z
    .string()
    .describe('Stable subject identifier')
    .meta({ examples: ['user-123'] }),
  attributes: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Subject attributes for targeting')
    .meta({
      examples: [{ country: 'RU', platform: 'ios', appVersion: '1.6.0' }],
    }),
  flagKeys: z
    .array(
      z
        .string()
        .trim()
        .min(FLAG_KEY_MIN_LENGTH)
        .max(FLAG_KEY_MAX_LENGTH)
        .regex(FLAG_KEY_FORMAT)
        .describe('Flag key')
        .meta({ examples: ['button_color'] }),
    )
    .max(100)
    .describe('List of flag keys to resolve')
    .meta({ examples: [['button_color', 'search_algorithm']] }),
});

export class DecideRequestDto extends createZodDto(DecideRequestSchema) {}
