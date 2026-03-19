import { describe, expect, it } from 'vitest';
import { DecideCommand } from '@/apps/decide-api/application/decide.command';
import { DecideUseCase } from '@/apps/decide-api/application/decide.use-case';
import { ResolvedFlags } from '@/apps/decide-api/application/services/flag.resolver';
import { DecideContext, Decision, DecisionReason } from '@/apps/decide-api/domain';
import { ParticipationPolicy } from '@/apps/decide-api/domain/subject-participation/participation-policy';
import { RuntimeExperimentView, RuntimeFlagView } from '@/contracts/decision-runtime';

function makeFlag(id: string, key: string): RuntimeFlagView {
  return {
    id,
    key,
    valueType: 'STRING',
    defaultValue: 'default',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  };
}
function makeExperiment(id: string, flagId: string, priority: number): RuntimeExperimentView {
  return {
    id,
    flagId,
    status: 'RUNNING',
    conflictDomain: null,
    priority,
    audiencePercent: 100,
    targetingRule: null,
    variants: [{ id: `${id}-a`, value: 'A', weight: 100, isControl: true }],
  };
}
function makeAssignedDecision(
  subjectId: string,
  flagId: string,
  experimentId: string,
  variantId: string,
): Decision {
  return {
    id: crypto.randomUUID(),
    subjectId,
    flagId,
    experimentId,
    variantId,
    value: 'A',
    reason: DecisionReason.EXPERIMENT_ASSIGNED,
    subjectAttributes: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
  };
}
class FlagResolverStub {
  constructor(private readonly resolved: ResolvedFlags) {}
  resolve(): ResolvedFlags {
    return this.resolved;
  }
}
class ExperimentAssignmentServiceStub {
  constructor(private readonly decisions: Map<string, Decision>) {}
  allocate(): Map<string, Decision> {
    return new Map(this.decisions);
  }
}
class DecideServiceStub {
  buildLimitExceededDecision(
    flag: RuntimeFlagView,
    experimentId: string | null,
    context: DecideContext,
  ): Decision {
    return {
      id: crypto.randomUUID(),
      subjectId: context.subjectId,
      flagId: flag.id,
      experimentId,
      variantId: null,
      value: flag.defaultValue,
      reason: DecisionReason.PARTICIPATION_LIMIT_EXCEEDED,
      subjectAttributes: null,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    };
  }
}
class DecisionAnalyticsRepositoryStub {
  async saveMany(): Promise<void> {}
}
class ParticipationLimiterStub {
  async getState() {
    return {
      version: 3,
      activeExperiments: new Map<string, string | null>(),
      meta: {
        windowStartMs: 0,
        assignmentsInWindow: 0,
        cooldownUntilMs: 0,
      },
    };
  }
  async putIfVersion(): Promise<boolean> {
    return true;
  }
}
class DecisionTokenSignerStub {
  signDecisionToken(): string {
    return 'signed-token';
  }
}
class RuntimeSnapshotProviderStub {
  isReady(): boolean {
    return true;
  }
  getActiveExperimentIds(): ReadonlySet<string> {
    return new Set(['exp-high', 'exp-low']);
  }
}
class LoggerStub {
  warn(): void {}
  error(): void {}
}
describe('DecideUseCase', () => {
  it('applies participation limits by experiment priority, not request order', async () => {
    const subjectId = 'subject-1';
    const lowFlag = makeFlag('flag-low', 'low_priority_flag');
    const highFlag = makeFlag('flag-high', 'high_priority_flag');
    const lowExperiment = makeExperiment('exp-low', lowFlag.id, 1);
    const highExperiment = makeExperiment('exp-high', highFlag.id, 100);
    const resolved: ResolvedFlags = {
      flags: [lowFlag, highFlag],
      requestedKeys: [
        { rawKey: 'low_priority_flag', key: 'low_priority_flag' },
        { rawKey: 'high_priority_flag', key: 'high_priority_flag' },
      ],
      experimentsByFlagId: {
        [lowFlag.id]: lowExperiment,
        [highFlag.id]: highExperiment,
      },
    };
    const decisions = new Map<string, Decision>([
      [lowFlag.id, makeAssignedDecision(subjectId, lowFlag.id, lowExperiment.id, 'v-low')],
      [highFlag.id, makeAssignedDecision(subjectId, highFlag.id, highExperiment.id, 'v-high')],
    ]);
    const useCase = new DecideUseCase(
      new FlagResolverStub(resolved) as never,
      new ExperimentAssignmentServiceStub(decisions) as never,
      new DecideServiceStub() as never,
      new DecisionAnalyticsRepositoryStub() as never,
      new ParticipationPolicy({
        maxConcurrentExperiments: 1,
        cooldownAfterTotal: 999,
        rollingWindowMs: 1000000,
        cooldownPeriodMs: 1000000,
      }),
      new ParticipationLimiterStub() as never,
      new DecisionTokenSignerStub() as never,
      new RuntimeSnapshotProviderStub() as never,
      new LoggerStub() as never,
    );
    const command: DecideCommand = {
      subjectId,
      attributes: {},
      flagKeys: ['low_priority_flag', 'high_priority_flag'],
    };
    const result = await useCase.execute(command);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw result.error;
    }
    const output = result.value;
    expect(output).toHaveLength(2);
    expect(output[0]?.flagKey).toBe('low_priority_flag');
    expect(output[0]?.reason).toBe(DecisionReason.PARTICIPATION_LIMIT_EXCEEDED);
    expect(output[1]?.flagKey).toBe('high_priority_flag');
    expect(output[1]?.reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
  });
});
