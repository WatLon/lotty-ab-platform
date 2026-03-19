import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import {
  optionalNormalizedUniqueStringArray,
  optionalNullableString,
  optionalNullableUrl,
  optionalNullableUuid,
} from './learning-input-normalizers';

export const CreateLearningEntrySchema = z.object({
  experimentId: optionalNullableUuid(),
  featureKey: optionalNullableString(128),
  team: optionalNullableString(128),
  title: z.string().trim().min(1).max(256),
  hypothesis: z.string().trim().min(1).max(2000),
  primaryMetricKey: z.string().trim().min(1).max(128),
  guardrailMetricKeys: optionalNormalizedUniqueStringArray(128),
  result: z.nativeEnum(ExperimentOutcomeType).nullable().optional(),
  actionTaken: z.string().trim().min(1).max(128),
  summary: z.string().trim().min(1).max(4000),
  notes: optionalNullableString(4000),
  tags: optionalNormalizedUniqueStringArray(64),
  countries: optionalNormalizedUniqueStringArray(64),
  platforms: optionalNormalizedUniqueStringArray(64),
  reportUrl: optionalNullableUrl(2048),
  ticketUrl: optionalNullableUrl(2048),
});

export class CreateLearningEntryDto extends createZodDto(CreateLearningEntrySchema) {}
