import { TargetingRuleEvaluator } from '@/shared/domain/targeting/evaluator';

describe('TargetingRuleEvaluator', () => {
  it('evaluates conditions', () => {
    const evaluator = new TargetingRuleEvaluator();

    expect(
      evaluator.evaluate({ attribute: 'country', op: 'eq', value: 'RU' }, { country: 'RU' }),
    ).toBe(true);

    expect(
      evaluator.evaluate({ attribute: 'country', op: 'neq', value: 'RU' }, { country: 'RU' }),
    ).toBe(false);

    expect(
      evaluator.evaluate(
        { attribute: 'country', op: 'in', value: ['RU', 'KZ'] },
        { country: 'KZ' },
      ),
    ).toBe(true);

    expect(
      evaluator.evaluate(
        { attribute: 'country', op: 'not_in', value: ['RU', 'KZ'] },
        { country: 'US' },
      ),
    ).toBe(true);
  });

  it('evaluates numeric comparisons', () => {
    const evaluator = new TargetingRuleEvaluator();

    expect(evaluator.evaluate({ attribute: 'age', op: 'gt', value: 18 }, { age: 19 })).toBe(true);

    expect(evaluator.evaluate({ attribute: 'age', op: 'gte', value: 18 }, { age: 18 })).toBe(true);

    expect(evaluator.evaluate({ attribute: 'age', op: 'lt', value: 18 }, { age: 18 })).toBe(false);

    expect(evaluator.evaluate({ attribute: 'age', op: 'lte', value: 18 }, { age: 18 })).toBe(true);
  });

  it('evaluates date comparisons (ISO strings)', () => {
    const evaluator = new TargetingRuleEvaluator();

    expect(
      evaluator.evaluate(
        { attribute: 'createdAt', op: 'gt', value: '2025-12-31T23:59:59Z' },
        { createdAt: '2026-01-01T00:00:00Z' },
      ),
    ).toBe(true);

    expect(
      evaluator.evaluate(
        { attribute: 'createdAt', op: 'gte', value: '2026-01-02' },
        { createdAt: '2026-01-02T00:00:00.000Z' },
      ),
    ).toBe(true);

    expect(
      evaluator.evaluate(
        { attribute: 'createdAt', op: 'eq', value: '2026-01-02T00:00:00Z' },
        { createdAt: '2026-01-02T00:00:00.000Z' },
      ),
    ).toBe(true);

    expect(
      evaluator.evaluate(
        {
          attribute: 'createdAt',
          op: 'in',
          value: ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'],
        },
        { createdAt: '2026-01-02T00:00:00.000Z' },
      ),
    ).toBe(true);

    expect(
      evaluator.evaluate(
        { attribute: 'createdAt', op: 'gt', value: '2026-01-01' },
        { createdAt: '2026' },
      ),
    ).toBe(false);
  });

  it('evaluates nested and/or/not', () => {
    const evaluator = new TargetingRuleEvaluator();

    const rule = {
      and: [
        { attribute: 'country', op: 'in', value: ['RU', 'KZ'] },
        {
          or: [
            { attribute: 'age', op: 'gte', value: 18 },
            { not: { attribute: 'tier', op: 'eq', value: 'banned' } },
          ],
        },
      ],
    } as const;

    expect(evaluator.evaluate(rule, { country: 'RU', age: 22, tier: 'free' })).toBe(true);

    expect(evaluator.evaluate(rule, { country: 'US', age: 22, tier: 'free' })).toBe(false);

    expect(evaluator.evaluate(rule, { country: 'KZ', age: 16, tier: 'banned' })).toBe(false);
  });

  it('fails closed when attribute is missing', () => {
    const evaluator = new TargetingRuleEvaluator();

    expect(evaluator.evaluate({ attribute: 'country', op: 'eq', value: 'RU' }, {})).toBe(false);
  });
});
