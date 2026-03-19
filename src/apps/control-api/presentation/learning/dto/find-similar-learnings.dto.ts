import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

export const FindSimilarLearningsSchema = z
  .object({
    learningId: z.string().uuid().optional(),
    experimentId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(20).optional(),
  })
  .refine((value) => Boolean(value.learningId || value.experimentId), {
    message: 'Either learningId or experimentId must be provided',
  });

export class FindSimilarLearningsDto extends createZodDto(FindSimilarLearningsSchema) {}
