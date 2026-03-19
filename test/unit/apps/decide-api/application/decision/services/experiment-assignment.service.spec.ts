import { describe, expect, it } from 'vitest';
import { ExperimentAssignmentService } from '@/apps/decide-api/application/services/experiment-assignment.service';
import { DecideContext, DecideService, Decision, DecisionReason } from '@/apps/decide-api/domain';
import { RuntimeExperimentView, RuntimeFlagView } from '@/contracts/decision-runtime';

function makeFlag(id: string): RuntimeFlagView {
  return {
    id,
    key: `flag_${id}`,
    valueType: 'STRING',
    defaultValue: 'default',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  };
}
function makeExperiment(
  id: string,
  flagId: string,
  priority: number,
  conflictDomain: string | null,
) {
  return {
    id,
    flagId,
    status: 'RUNNING',
    conflictDomain,
    priority,
    audiencePercent: 100,
    targetingRule: null,
    variants: [{ id: `${id}-A`, value: 'A', weight: 100, isControl: true }],
  } as RuntimeExperimentView;
}
function makeDecision(
  flagId: string,
  reason: DecisionReason,
  experimentId: string | null,
): Decision {
  return {
    id: crypto.randomUUID(),
    subjectId: 'subject-1',
    flagId,
    experimentId,
    variantId: experimentId ? `${experimentId}-A` : null,
    value: experimentId ? 'A' : 'default',
    reason,
    subjectAttributes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
class DecideServiceStub {
  defaultCalls: Array<{
    flagId: string;
    reason: DecisionReason;
  }> = [];
  decideCalls: string[] = [];
  decideResponses = new Map<string, Decision>();
  buildDefaultDecision(
    flag: RuntimeFlagView,
    _context: DecideContext,
    reason: DecisionReason,
  ): Decision {
    this.defaultCalls.push({ flagId: flag.id, reason });
    return makeDecision(flag.id, reason, null);
  }
  decide(flag: RuntimeFlagView, experiment: RuntimeExperimentView): Decision {
    this.decideCalls.push(experiment.id);
    return (
      this.decideResponses.get(experiment.id) ??
      makeDecision(flag.id, DecisionReason.EXPERIMENT_ASSIGNED, experiment.id)
    );
  }
}
describe('ExperimentAssignmentService', () => {
  it('returns default decision when there is no experiment for flag', () => {
    const decideService = new DecideServiceStub();
    const service = new ExperimentAssignmentService(decideService as unknown as DecideService);
    const decisions = service.allocate({
      flags: [makeFlag('flag-1')],
      experimentsByFlagId: {},
      context: { subjectId: 'subject-1', attributes: {} },
      occupiedDomains: new Map(),
    });
    expect(decisions.get('flag-1')?.reason).toBe(DecisionReason.FLAG_DEFAULT);
    expect(decideService.defaultCalls).toEqual([
      { flagId: 'flag-1', reason: DecisionReason.FLAG_DEFAULT },
    ]);
  });
  it('sorts experiments by priority desc then id and resolves conflicts by domain', () => {
    const decideService = new DecideServiceStub();
    const service = new ExperimentAssignmentService(decideService as unknown as DecideService);
    const flagA = makeFlag('flag-a');
    const flagB = makeFlag('flag-b');
    const expA = makeExperiment('exp-z', 'flag-a', 10, 'checkout');
    const expB = makeExperiment('exp-a', 'flag-b', 10, 'checkout');
    decideService.decideResponses.set(
      'exp-a',
      makeDecision('flag-b', DecisionReason.EXPERIMENT_ASSIGNED, 'exp-a'),
    );
    decideService.decideResponses.set(
      'exp-z',
      makeDecision('flag-a', DecisionReason.EXPERIMENT_ASSIGNED, 'exp-z'),
    );
    const decisions = service.allocate({
      flags: [flagA, flagB],
      experimentsByFlagId: {
        [flagA.id]: expA,
        [flagB.id]: expB,
      },
      context: { subjectId: 'subject-1', attributes: {} },
      occupiedDomains: new Map(),
    });
    expect(decideService.decideCalls).toEqual(['exp-a']);
    expect(decisions.get('flag-b')?.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(decisions.get('flag-a')?.reason).toBe(DecisionReason.EXPERIMENT_CONFLICT);
    expect(decideService.defaultCalls).toContainEqual({
      flagId: 'flag-a',
      reason: DecisionReason.EXPERIMENT_CONFLICT,
    });
  });
  it('does not reserve domain when decision is not EXPERIMENT_ASSIGNED', () => {
    const decideService = new DecideServiceStub();
    const service = new ExperimentAssignmentService(decideService as unknown as DecideService);
    const flag = makeFlag('flag-1');
    const experiment = makeExperiment('exp-1', 'flag-1', 1, 'checkout');
    decideService.decideResponses.set(
      'exp-1',
      makeDecision('flag-1', DecisionReason.NOT_IN_AUDIENCE, null),
    );
    const occupiedDomains = new Map<string, string>();
    const decisions = service.allocate({
      flags: [flag],
      experimentsByFlagId: { [flag.id]: experiment },
      context: { subjectId: 'subject-1', attributes: {} },
      occupiedDomains,
    });
    expect(decisions.get('flag-1')?.reason).toBe(DecisionReason.NOT_IN_AUDIENCE);
    expect(occupiedDomains.has('checkout')).toBe(false);
  });
  it('does not mutate input occupiedDomains and still ignores non-conflicting experiments', () => {
    const decideService = new DecideServiceStub();
    const service = new ExperimentAssignmentService(decideService as unknown as DecideService);
    const flagA = makeFlag('flag-a');
    const flagB = makeFlag('flag-b');
    const expA = makeExperiment('exp-a', 'flag-a', 20, 'checkout');
    const expB = makeExperiment('exp-b', 'flag-b', 10, null);
    const occupiedDomains = new Map<string, string>([['search', 'exp-x']]);
    const decisions = service.allocate({
      flags: [flagA, flagB],
      experimentsByFlagId: {
        [flagA.id]: expA,
        [flagB.id]: expB,
      },
      context: { subjectId: 'subject-1', attributes: {} },
      occupiedDomains,
    });
    expect(decisions.get('flag-a')?.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(decisions.get('flag-b')?.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(occupiedDomains.has('checkout')).toBe(false);
    expect(occupiedDomains.get('search')).toBe('exp-x');
  });
});
