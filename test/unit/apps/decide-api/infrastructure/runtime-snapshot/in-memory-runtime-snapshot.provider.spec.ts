import { describe, expect, it } from 'vitest';
import { InMemoryRuntimeSnapshotProvider } from '@/apps/decide-api/infrastructure/runtime-snapshot.provider';
import { RuntimeSnapshotMessage } from '@/contracts/decision-runtime';

interface SnapshotOverrides {
  generatedAt?: string;
  flag?: Partial<RuntimeSnapshotMessage['flag']>;
  experiment?: Partial<NonNullable<RuntimeSnapshotMessage['experiment']>> | null;
}
function createSnapshot(overrides?: SnapshotOverrides): RuntimeSnapshotMessage {
  const base: RuntimeSnapshotMessage = {
    generatedAt: '2026-02-20T18:00:00.000Z',
    flag: {
      id: 'flag-id',
      key: 'button_color',
      valueType: 'STRING',
      defaultValue: 'green',
      description: null,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: null,
    },
    experiment: {
      id: 'exp-id',
      flagId: 'flag-id',
      status: 'RUNNING',
      conflictDomain: 'checkout',
      priority: 1,
      audiencePercent: 20,
      targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
      variants: [
        { id: 'v1', value: 'blue', weight: 10, isControl: true },
        { id: 'v2', value: 'red', weight: 10, isControl: false },
      ],
    },
  };
  const flag = { ...base.flag, ...(overrides?.flag ?? {}) };
  const experiment =
    overrides?.experiment === null
      ? null
      : {
          ...(base.experiment as NonNullable<RuntimeSnapshotMessage['experiment']>),
          ...(overrides?.experiment ?? {}),
        };
  return {
    generatedAt: overrides?.generatedAt ?? base.generatedAt,
    flag,
    experiment,
  };
}
describe('InMemoryRuntimeSnapshotProvider', () => {
  it('starts as not ready and returns nulls for unknown keys', () => {
    const provider = new InMemoryRuntimeSnapshotProvider();
    expect(provider.isReady()).toBe(false);
    expect(provider.getFlagsByKeys(['missing'])).toEqual({ missing: null });
    expect(provider.getExperimentsByFlagIds(['missing'])).toEqual({ missing: null });
    expect(provider.getActiveExperimentIds().size).toBe(0);
  });
  it('applies snapshots and serves flags/experiments by key and flag id', () => {
    const provider = new InMemoryRuntimeSnapshotProvider();
    provider.apply(createSnapshot());
    expect(provider.isReady()).toBe(true);
    expect(provider.getFlagsByKeys(['button_color', 'unknown'])).toEqual({
      button_color: {
        id: 'flag-id',
        key: 'button_color',
        valueType: 'STRING',
        defaultValue: 'green',
        description: null,
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: null,
      },
      unknown: null,
    });
    expect(provider.getExperimentsByFlagIds(['flag-id', 'unknown'])).toEqual({
      'flag-id': {
        id: 'exp-id',
        flagId: 'flag-id',
        status: 'RUNNING',
        conflictDomain: 'checkout',
        priority: 1,
        audiencePercent: 20,
        targetingRule: { attribute: 'country', op: 'eq', value: 'RU' },
        variants: [
          { id: 'v1', value: 'blue', weight: 10, isControl: true },
          { id: 'v2', value: 'red', weight: 10, isControl: false },
        ],
      },
      unknown: null,
    });
    expect(provider.getActiveExperimentIds()).toEqual(new Set(['exp-id']));
  });
  it('ignores stale snapshot and accepts newer snapshot updates', () => {
    const provider = new InMemoryRuntimeSnapshotProvider();
    provider.apply(
      createSnapshot({
        generatedAt: '2026-02-20T18:10:00.000Z',
        flag: { defaultValue: 'green' },
      }),
    );
    provider.apply(
      createSnapshot({
        generatedAt: '2026-02-20T18:05:00.000Z',
        flag: { defaultValue: 'black' },
      }),
    );
    expect(provider.getFlagsByKeys(['button_color']).button_color?.defaultValue).toBe('green');
    provider.apply(
      createSnapshot({
        generatedAt: '2026-02-20T18:20:00.000Z',
        flag: { defaultValue: 'orange' },
        experiment: null,
      }),
    );
    expect(provider.getFlagsByKeys(['button_color']).button_color?.defaultValue).toBe('orange');
    expect(provider.getExperimentsByFlagIds(['flag-id'])).toEqual({ 'flag-id': null });
    expect(provider.getActiveExperimentIds().size).toBe(0);
  });
  it('handles invalid generatedAt by falling back to current time', () => {
    const provider = new InMemoryRuntimeSnapshotProvider();
    provider.apply(createSnapshot({ generatedAt: 'invalid-date' }));
    expect(provider.getFlagsByKeys(['button_color']).button_color).not.toBeNull();
    expect(provider.getExperimentsByFlagIds(['flag-id'])['flag-id']).not.toBeNull();
  });
  it('supports markReady and reset lifecycle', () => {
    const provider = new InMemoryRuntimeSnapshotProvider();
    provider.markReady();
    expect(provider.isReady()).toBe(true);
    provider.apply(createSnapshot());
    expect(provider.getActiveExperimentIds()).toEqual(new Set(['exp-id']));
    provider.reset();
    expect(provider.isReady()).toBe(false);
    expect(provider.getFlagsByKeys(['button_color'])).toEqual({ button_color: null });
    expect(provider.getExperimentsByFlagIds(['flag-id'])).toEqual({ 'flag-id': null });
  });
});
