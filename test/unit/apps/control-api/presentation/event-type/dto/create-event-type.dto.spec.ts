import { describe, expect, it } from 'vitest';
import { CreateEventTypeSchema } from '@/apps/control-api/presentation/event-type/dto/create-event-type.dto';

describe('CreateEventTypeSchema', () => {
  it('accepts valid payload', () => {
    const result = CreateEventTypeSchema.safeParse({
      key: 'button.clicked',
      name: 'Button Clicked',
      description: 'User clicked a button',
      schema: { type: 'object', properties: { screen: { type: 'string' } } },
      requiresExposure: true,
    });
    expect(result.success).toBe(true);
  });
  it('rejects blank name', () => {
    const result = CreateEventTypeSchema.safeParse({
      key: 'button.clicked',
      name: '   ',
      requiresExposure: true,
    });
    expect(result.success).toBe(false);
  });
  it('rejects invalid JSON schema', () => {
    const result = CreateEventTypeSchema.safeParse({
      key: 'button.clicked',
      name: 'Button Clicked',
      schema: { type: 123 },
      requiresExposure: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes('Invalid event schema')),
      ).toBe(true);
    }
  });
});
