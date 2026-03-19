import { describe, expect, it } from 'vitest';
import { ApiErrorResponses } from '@/shared/presentation/common/decorators/api-error-responses.decorator';
import { ValidationErrorCode } from '@/shared/presentation/common/errors';

describe('ApiErrorResponses decorator', () => {
  it('returns decorator with default options', () => {
    const decorator = ApiErrorResponses();

    expect(typeof decorator).toBe('function');
  });

  it('supports all boolean switches and conflict codes', () => {
    const decorator = ApiErrorResponses({
      badRequest: true,
      notFound: true,
      forbidden: true,
      unauthorized: true,
      conflict: ['CONCURRENCY_CONFLICT'],
    });

    expect(typeof decorator).toBe('function');
  });

  it('supports custom badRequest and unauthorized codes', () => {
    const decorator = ApiErrorResponses({
      badRequest: [ValidationErrorCode.REQUIRED],
      unauthorized: ['TOKEN_EXPIRED'],
      conflict: [],
    });

    expect(typeof decorator).toBe('function');
  });
});
