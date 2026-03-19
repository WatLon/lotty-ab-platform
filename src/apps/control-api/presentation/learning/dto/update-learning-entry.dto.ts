import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import {
  optionalNormalizedUniqueStringArray,
  optionalNullableString,
  optionalNullableUrl,
  optionalNullableUuid,
} from './learning-input-normalizers';

export const UpdateLearningEntrySchema = z
  .object({
    experimentId: optionalNullableUuid(),
    featureKey: optionalNullableString(128),
    team: optionalNullableString(128),
    title: z.string().trim().min(1).max(256).optional(),
    hypothesis: z.string().trim().min(1).max(2000).optional(),
    primaryMetricKey: z.string().trim().min(1).max(128).optional(),
    guardrailMetricKeys: optionalNormalizedUniqueStringArray(128),
    result: z.nativeEnum(ExperimentOutcomeType).nullable().optional(),
    actionTaken: z.string().trim().min(1).max(128).optional(),
    summary: z.string().trim().min(1).max(4000).optional(),
    notes: optionalNullableString(4000),
    tags: optionalNormalizedUniqueStringArray(64),
    countries: optionalNormalizedUniqueStringArray(64),
    platforms: optionalNormalizedUniqueStringArray(64),
    reportUrl: optionalNullableUrl(2048),
    ticketUrl: optionalNullableUrl(2048),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export class UpdateLearningEntryDto extends createZodDto(UpdateLearningEntrySchema) {}
