import { describe, expect, it } from 'vitest';
import { ValueObject } from '@/shared/domain/common';

class NestedValueObject extends ValueObject<{ value: string }> {
  static create(value: string): NestedValueObject {
    return new NestedValueObject({ value });
  }

  get value(): string {
    return this.props.value;
  }
}

class CompositeValueObject extends ValueObject<{
  name: string;
  count: number;
  date: Date;
  tags: string[];
  nested: { ok: boolean };
  vo: NestedValueObject;
}> {
  static create(input: {
    name: string;
    count: number;
    date: Date;
    tags: string[];
    nested: { ok: boolean };
    vo: NestedValueObject;
  }): CompositeValueObject {
    return new CompositeValueObject(input);
  }

  get snapshot() {
    return this.props;
  }
}

describe('ValueObject base', () => {
  it('returns false when compared with nullish and non-value-object', () => {
    const value = CompositeValueObject.create({
      name: 'x',
      count: 1,
      date: new Date('2026-01-01T00:00:00.000Z'),
      tags: ['a'],
      nested: { ok: true },
      vo: NestedValueObject.create('nested'),
    });

    expect(value.equals(undefined)).toBe(false);
    expect(value.equals(null)).toBe(false);
    expect(value.equals({})).toBe(false);
  });

  it('supports same reference equality', () => {
    const value = CompositeValueObject.create({
      name: 'x',
      count: 1,
      date: new Date('2026-01-01T00:00:00.000Z'),
      tags: ['a'],
      nested: { ok: true },
      vo: NestedValueObject.create('nested'),
    });

    expect(value.equals(value)).toBe(true);
  });

  it('deep freezes nested structures and keeps nested value objects intact', () => {
    const nestedVo = NestedValueObject.create('nested');
    const value = CompositeValueObject.create({
      name: 'x',
      count: 1,
      date: new Date('2026-01-01T00:00:00.000Z'),
      tags: ['a', 'b'],
      nested: { ok: true },
      vo: nestedVo,
    });

    expect(Object.isFrozen(value.snapshot)).toBe(true);
    expect(Object.isFrozen(value.snapshot.tags)).toBe(true);
    expect(Object.isFrozen(value.snapshot.nested)).toBe(true);
    expect(value.snapshot.vo).toBe(nestedVo);
  });

  it('compares deeply equal objects as equal', () => {
    const left = CompositeValueObject.create({
      name: 'same',
      count: 10,
      date: new Date('2026-02-01T10:00:00.000Z'),
      tags: ['a', 'b'],
      nested: { ok: true },
      vo: NestedValueObject.create('same-vo'),
    });
    const right = CompositeValueObject.create({
      name: 'same',
      count: 10,
      date: new Date('2026-02-01T10:00:00.000Z'),
      tags: ['a', 'b'],
      nested: { ok: true },
      vo: NestedValueObject.create('same-vo'),
    });

    expect(left.equals(right)).toBe(true);
  });

  it('detects inequality for array length, object shape and date mismatch', () => {
    const base = CompositeValueObject.create({
      name: 'base',
      count: 1,
      date: new Date('2026-02-01T10:00:00.000Z'),
      tags: ['a', 'b'],
      nested: { ok: true },
      vo: NestedValueObject.create('same-vo'),
    });
    const withShortArray = CompositeValueObject.create({
      name: 'base',
      count: 1,
      date: new Date('2026-02-01T10:00:00.000Z'),
      tags: ['a'],
      nested: { ok: true },
      vo: NestedValueObject.create('same-vo'),
    });
    const withDifferentNested = CompositeValueObject.create({
      name: 'base',
      count: 1,
      date: new Date('2026-02-01T10:00:00.000Z'),
      tags: ['a', 'b'],
      nested: { ok: false },
      vo: NestedValueObject.create('same-vo'),
    });
    const withDifferentDate = CompositeValueObject.create({
      name: 'base',
      count: 1,
      date: new Date('2026-02-01T10:00:01.000Z'),
      tags: ['a', 'b'],
      nested: { ok: true },
      vo: NestedValueObject.create('same-vo'),
    });

    expect(base.equals(withShortArray)).toBe(false);
    expect(base.equals(withDifferentNested)).toBe(false);
    expect(base.equals(withDifferentDate)).toBe(false);
  });
});
