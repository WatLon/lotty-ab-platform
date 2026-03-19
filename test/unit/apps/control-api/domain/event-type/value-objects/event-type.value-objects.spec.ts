import { describe, expect, it } from 'vitest';
import {
  EventTypeDescription,
  EventTypeName,
  EventTypeSchema,
} from '@/apps/control-api/domain/event-type';

describe('EventType value objects', () => {
  it('validates event type name', () => {
    const created = EventTypeName.create('  Button Clicked  ');
    expect(created.isOk()).toBe(true);
    if (created.isOk()) {
      expect(created.value.value).toBe('Button Clicked');
    }
    const blank = EventTypeName.create('   ');
    expect(blank.isErr()).toBe(true);
  });
  it('validates event type description max length', () => {
    const valid = EventTypeDescription.create('  short description  ');
    expect(valid.isOk()).toBe(true);
    if (valid.isOk()) {
      expect(valid.value.value).toBe('short description');
    }
    const tooLong = EventTypeDescription.create('a'.repeat(1001));
    expect(tooLong.isErr()).toBe(true);
  });
  it('validates event type schema', () => {
    expect(EventTypeSchema.create(null).isOk()).toBe(true);
    expect(EventTypeSchema.create({ type: 'object', properties: {} }).isOk()).toBe(true);
    expect(EventTypeSchema.create([]).isErr()).toBe(true);
    expect(EventTypeSchema.create({ type: 123 }).isErr()).toBe(true);
  });
});
