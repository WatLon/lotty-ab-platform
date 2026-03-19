import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { FlagDefaultValue, FlagKey, FlagValueType } from '@/apps/control-api/domain/flag';

export const CreateFlagSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(FlagKey.MIN_LENGTH)
      .max(FlagKey.MAX_LENGTH)
      .regex(FlagKey.FORMAT)
      .describe('Unique flag key (snake_case)')
      .meta({ examples: ['button_color'] }),
    valueType: z
      .nativeEnum(FlagValueType)
      .describe('Flag value type')
      .meta({ examples: [FlagValueType.STRING] }),
    defaultValue: z
      .string()
      .describe('Default value (as string)')
      .meta({ examples: ['green'] }),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Optional description')
      .meta({ examples: ['Color of the buy button'] }),
  })
  .superRefine((data, ctx) => {
    const result = FlagDefaultValue.create(data.defaultValue, data.valueType);
    if (result.isErr()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultValue'],
        message: result.error.message,
      });
    }
  });

export class CreateFlagDto extends createZodDto(CreateFlagSchema) {}
