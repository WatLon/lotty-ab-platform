import { describe, expect, it } from 'vitest';
import { DecideContext, DecideService } from '@/apps/decide-api/domain/decide.service';
import { DecisionReason } from '@/apps/decide-api/domain/decision-reason.enum';
import { RuntimeExperimentView, RuntimeFlagView } from '@/contracts/decision-runtime';
import { TargetingRuleEvaluator, TargetingRuleParser } from '@/shared/domain/targeting';

function createFlag(defaultValue = 'green'): RuntimeFlagView {
  return {
    id: 'flag-button-color',
    key: 'button_color',
    valueType: 'STRING',
    defaultValue,
    description: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}
function createVariants(): RuntimeExperimentView['variants'] {
  return [
    {
      id: 'variant-control',
      value: 'blue',
      weight: 50,
      isControl: true,
    },
    {
      id: 'variant-treatment',
      value: 'red',
      weight: 50,
      isControl: false,
    },
  ];
}
function createRunningExperiment(overrides?: {
  audiencePercent?: number;
  targetingRule?: unknown;
}): RuntimeExperimentView {
  return {
    id: 'exp-button-color',
    flagId: 'flag-button-color',
    status: 'RUNNING',
    conflictDomain: null,
    priority: 10,
    audiencePercent: overrides?.audiencePercent ?? 100,
    targetingRule: overrides?.targetingRule ?? null,
    variants: createVariants(),
  };
}
function createContext(
  subjectId = 'user-1',
  attributes: Record<string, unknown> = {},
): DecideContext {
  return { subjectId, attributes };
}
describe('DecideService', () => {
  const service = new DecideService(new TargetingRuleParser(), new TargetingRuleEvaluator());
  describe('paused experiment', () => {
    it('returns EXPERIMENT_PAUSED with default value', () => {
      const flag = createFlag('green');
      const experiment: RuntimeExperimentView = {
        ...createRunningExperiment(),
        status: 'PAUSED',
      };
      const decision = service.decide(flag, experiment, createContext());
      expect(decision.value).toBe('green');
      expect(decision.reason).toBe(DecisionReason.EXPERIMENT_PAUSED);
    });
  });
  describe('targeting', () => {
    it('returns TARGETING_NOT_MATCHED when attributes do not match', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({
        targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
      });
      const decision = service.decide(flag, experiment, createContext('user-1', { country: 'US' }));
      expect(decision.value).toBe('green');
      expect(decision.reason).toBe(DecisionReason.TARGETING_NOT_MATCHED);
    });
    it('passes targeting when attributes match', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({
        targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
      });
      const decision = service.decide(flag, experiment, createContext('user-1', { country: 'RU' }));
      expect(decision.reason).not.toBe(DecisionReason.TARGETING_NOT_MATCHED);
    });
  });
  describe('audience', () => {
    it('returns NOT_IN_AUDIENCE when subject outside audience percent', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({ audiencePercent: 2 });
      let notInAudience = 0;
      for (let i = 0; i < 100; i++) {
        const decision = service.decide(flag, experiment, createContext(`user-miss-${i}`));
        if (decision.reason === DecisionReason.NOT_IN_AUDIENCE) {
          notInAudience++;
        }
      }
      expect(notInAudience).toBeGreaterThan(90);
    });
  });
  describe('variant assignment', () => {
    it('returns EXPERIMENT_ASSIGNED with variant value', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({ audiencePercent: 100 });
      const decision = service.decide(flag, experiment, createContext('user-1'));
      expect(decision.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
      expect(['blue', 'red']).toContain(decision.value);
      expect(decision.experimentId).not.toBeNull();
      expect(decision.variantId).not.toBeNull();
    });
    it('is deterministic - same subject gets same variant', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({ audiencePercent: 100 });
      const d1 = service.decide(flag, experiment, createContext('sticky-user'));
      const d2 = service.decide(flag, experiment, createContext('sticky-user'));
      expect(d1.value).toBe(d2.value);
      expect(d1.variantId).toBe(d2.variantId);
    });
    it('stores subjectAttributes when provided', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({ audiencePercent: 100 });
      const decision = service.decide(flag, experiment, createContext('user-1', { country: 'RU' }));
      expect(decision.subjectAttributes).toEqual({ country: 'RU' });
    });
    it('stores null subjectAttributes when empty', () => {
      const flag = createFlag('green');
      const experiment = createRunningExperiment({ audiencePercent: 100 });
      const decision = service.decide(flag, experiment, createContext('user-1', {}));
      expect(decision.subjectAttributes).toBeNull();
    });
  });
});
