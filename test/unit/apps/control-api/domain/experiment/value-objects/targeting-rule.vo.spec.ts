import { TargetingRule } from '@/apps/control-api/domain/experiment/value-objects/targeting-rule.vo';
import { InvalidFormatError } from '@/shared/domain/common/errors';

describe('TargetingRule', () => {
  it('accepts null rule and evaluates to true', () => {
    const result = TargetingRule.create(null);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.isEmpty).toBe(true);
      expect(result.value.evaluate({ any: 'value' })).toBe(true);
    }
  });

  it('normalizes condition attribute by trimming spaces', () => {
    const result = TargetingRule.create({
      attribute: ' country ',
      op: 'eq',
      value: 'RU',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.toJSON()).toEqual({
        attribute: 'country',
        op: 'eq',
        value: 'RU',
      });
    }
  });

  it('rejects mixed rule shapes', () => {
    const result = TargetingRule.create({
      and: [{ attribute: 'country', op: 'eq', value: 'RU' }],
      or: [{ attribute: 'country', op: 'eq', value: 'KZ' }],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(InvalidFormatError);
    }
  });

  it('rejects condition with extra keys', () => {
    const result = TargetingRule.create({
      attribute: 'country',
      op: 'eq',
      value: 'RU',
      extra: true,
    });

    expect(result.isErr()).toBe(true);
  });

  it('rejects empty and/or groups', () => {
    const andResult = TargetingRule.create({ and: [] });
    const orResult = TargetingRule.create({ or: [] });

    expect(andResult.isErr()).toBe(true);
    expect(orResult.isErr()).toBe(true);
  });

  it('rejects in/not_in with non-array value', () => {
    const inResult = TargetingRule.create({
      attribute: 'country',
      op: 'in',
      value: 'RU',
    });
    const notInResult = TargetingRule.create({
      attribute: 'country',
      op: 'not_in',
      value: 'RU',
    });

    expect(inResult.isErr()).toBe(true);
    expect(notInResult.isErr()).toBe(true);
  });

  it('rejects empty attribute', () => {
    const result = TargetingRule.create({
      attribute: '   ',
      op: 'eq',
      value: 'RU',
    });

    expect(result.isErr()).toBe(true);
  });

  it('rejects rules deeper than allowed limit', () => {
    let rule: unknown = {
      attribute: 'country',
      op: 'eq',
      value: 'RU',
    };

    for (let i = 0; i < 20; i += 1) {
      rule = { not: rule };
    }

    const result = TargetingRule.create(rule);

    expect(result.isErr()).toBe(true);
  });

  it('rejects rules with too many nodes', () => {
    const children = Array.from({ length: 129 }, (_, index) => ({
      attribute: 'segment',
      op: 'eq',
      value: index,
    }));
    const result = TargetingRule.create({ and: children });

    expect(result.isErr()).toBe(true);
  });

  it('evaluates nested rules correctly', () => {
    const result = TargetingRule.create({
      and: [
        { attribute: 'country', op: 'in', value: ['RU', 'KZ'] },
        {
          or: [
            { attribute: 'age', op: 'gte', value: 18 },
            { not: { attribute: 'tier', op: 'eq', value: 'banned' } },
          ],
        },
      ],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.evaluate({ country: 'RU', age: 22, tier: 'free' })).toBe(true);
      expect(result.value.evaluate({ country: 'US', age: 22, tier: 'free' })).toBe(false);
      expect(result.value.evaluate({ country: 'KZ', age: 16, tier: 'banned' })).toBe(false);
      expect(result.value.evaluate({ age: 25, tier: 'free' })).toBe(false);
    }
  });

  it('fails closed on invalid reconstituted rule', () => {
    const rule = TargetingRule.reconstitute({ and: [] });

    expect(rule.isEmpty).toBe(false);
    expect(rule.evaluate({ country: 'RU' })).toBe(false);
    expect(rule.toJSON()).toEqual({ and: [] });
  });
});
