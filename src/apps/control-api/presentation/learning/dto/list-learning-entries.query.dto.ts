import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';

function parseCsvList(raw?: string): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return values.length > 0 ? values : undefined;
}

function optionalDateQuery(fieldName: 'createdFrom' | 'createdTo') {
  return z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(new Date(value).getTime()), {
      message: `${fieldName} must be a valid ISO-8601 date`,
    })
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return new Date(value);
    });
}

const OptionalIntegerQuerySchema = z
  .string()
  .regex(/^-?\d+$/, { message: 'must be an integer' })
  .transform((value) => Number.parseInt(value, 10))
  .optional();

const OptionalBooleanQuerySchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value === 'true';
  });

const OptionalCsvListQuerySchema = z
  .string()
  .optional()
  .transform((value) => parseCsvList(value));

export const ListLearningEntriesQuerySchema = z.object({
  limit: OptionalIntegerQuerySchema,
  offset: OptionalIntegerQuerySchema,
  q: z.string().optional(),
  experimentId: z.string().optional(),
  featureKey: z.string().optional(),
  team: z.string().optional(),
  result: z.nativeEnum(ExperimentOutcomeType).optional(),
  countries: OptionalCsvListQuerySchema,
  platforms: OptionalCsvListQuerySchema,
  includeArchived: OptionalBooleanQuerySchema,
  createdFrom: optionalDateQuery('createdFrom'),
  createdTo: optionalDateQuery('createdTo'),
});

export class ListLearningEntriesQueryDto extends createZodDto(ListLearningEntriesQuerySchema) {}
