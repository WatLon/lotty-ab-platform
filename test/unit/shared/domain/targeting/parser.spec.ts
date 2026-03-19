import { TargetingParseErrorCode } from '@/shared/domain/targeting/errors';
import { TargetingRuleParser } from '@/shared/domain/targeting/parser';

describe('TargetingRuleParser', () => {
  it('parses a condition and normalizes attribute by trimming', () => {
    const parser = new TargetingRuleParser();
    const result = parser.parse({
      attribute: ' country ',
      op: 'eq',
      value: 'RU',
    });
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      expect(result.value).toEqual({
        attribute: 'country',
        op: 'eq',
        value: 'RU',
      });
    }
  });
  it('returns MIXED_NODE_SHAPE for mixed node forms', () => {
    const parser = new TargetingRuleParser();
    const result = parser.parse({
      and: [{ attribute: 'country', op: 'eq', value: 'RU' }],
      or: [{ attribute: 'country', op: 'eq', value: 'KZ' }],
    });
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.code).toBe(TargetingParseErrorCode.MIXED_NODE_SHAPE);
    }
  });
  it('returns UNKNOWN_KEYS for condition with extra keys', () => {
    const parser = new TargetingRuleParser();
    const result = parser.parse({
      attribute: 'country',
      op: 'eq',
      value: 'RU',
      extra: true,
    });
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.code).toBe(TargetingParseErrorCode.UNKNOWN_KEYS);
    }
  });
  it('returns EMPTY_GROUP for empty and/or group', () => {
    const parser = new TargetingRuleParser();
    const andResult = parser.parse({ and: [] });
    const orResult = parser.parse({ or: [] });
    expect(andResult.isErr()).toBe(true);
    expect(orResult.isErr()).toBe(true);

    if (andResult.isErr()) {
      expect(andResult.error.code).toBe(TargetingParseErrorCode.EMPTY_GROUP);
    }

    if (orResult.isErr()) {
      expect(orResult.error.code).toBe(TargetingParseErrorCode.EMPTY_GROUP);
    }
  });
  it('returns INVALID_IN_VALUE for in/not_in with non-array value', () => {
    const parser = new TargetingRuleParser();
    const inResult = parser.parse({
      attribute: 'country',
      op: 'in',
      value: 'RU',
    });
    const notInResult = parser.parse({
      attribute: 'country',
      op: 'not_in',
      value: 'RU',
    });
    expect(inResult.isErr()).toBe(true);
    expect(notInResult.isErr()).toBe(true);

    if (inResult.isErr()) {
      expect(inResult.error.code).toBe(TargetingParseErrorCode.INVALID_IN_VALUE);
    }

    if (notInResult.isErr()) {
      expect(notInResult.error.code).toBe(TargetingParseErrorCode.INVALID_IN_VALUE);
    }
  });
  it('returns DEPTH_LIMIT_EXCEEDED for too deep rules', () => {
    const parser = new TargetingRuleParser();
    let rule: unknown = { attribute: 'country', op: 'eq', value: 'RU' };

    for (let i = 0; i < 20; i += 1) {
      rule = { not: rule };
    }

    const result = parser.parse(rule);
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.code).toBe(TargetingParseErrorCode.DEPTH_LIMIT_EXCEEDED);
    }
  });
  it('returns NODE_LIMIT_EXCEEDED for too many nodes', () => {
    const parser = new TargetingRuleParser();
    const children = Array.from({ length: 129 }, (_, index) => ({
      attribute: 'segment',
      op: 'eq',
      value: index,
    }));
    const result = parser.parse({ and: children });
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.code).toBe(TargetingParseErrorCode.NODE_LIMIT_EXCEEDED);
    }
  });
});
