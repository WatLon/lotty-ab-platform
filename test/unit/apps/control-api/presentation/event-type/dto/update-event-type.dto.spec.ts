import { describe, expect, it } from 'vitest';
import { UpdateEventTypeSchema } from '@/apps/control-api/presentation/event-type/dto/update-event-type.dto';

describe('UpdateEventTypeSchema', () => {
  it('accepts empty payload and valid updates', () => {
    expect(UpdateEventTypeSchema.safeParse({}).success).toBe(true);
    expect(
      UpdateEventTypeSchema.safeParse({
        name: 'Updated Event Type',
        description: 'Updated description',
        schema: { type: 'object' },
      }).success,
    ).toBe(true);
  });
  it('rejects blank name', () => {
    const result = UpdateEventTypeSchema.safeParse({ name: '   ' });
    expect(result.success).toBe(false);
  });
  it('rejects too long description', () => {
    const result = UpdateEventTypeSchema.safeParse({ description: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });
  it('rejects invalid schema', () => {
    const result = UpdateEventTypeSchema.safeParse({ schema: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes('Invalid event schema')),
      ).toBe(true);
    }
  });
});
