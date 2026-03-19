import { Injectable } from '@nestjs/common';
import { RuntimeSnapshotProvider } from '@/apps/decide-api/application';
import type {
  RuntimeExperimentView as ExperimentRuntime,
  RuntimeFlagView,
  RuntimeSnapshotMessage,
} from '@/contracts/decision-runtime';

interface FlagSnapshotEntry {
  flag: RuntimeFlagView;
  experiment: ExperimentRuntime | null;
  generatedAtMs: number;
}

@Injectable()
export class InMemoryRuntimeSnapshotProvider extends RuntimeSnapshotProvider {
  private readonly byFlagKey = new Map<string, FlagSnapshotEntry>();

  private readonly flagKeyById = new Map<string, string>();

  private ready = false;
  getFlagsByKeys(keys: string[]): Record<string, RuntimeFlagView | null> {
    const result: Record<string, RuntimeFlagView | null> = {};
    for (const key of keys) {
      const entry = this.byFlagKey.get(key) ?? null;
      result[key] = entry?.flag ?? null;
    }
    return result;
  }
  getExperimentsByFlagIds(flagIds: string[]): Record<string, ExperimentRuntime | null> {
    const result: Record<string, ExperimentRuntime | null> = {};
    for (const flagId of flagIds) {
      const key = this.flagKeyById.get(flagId);
      if (!key) {
        result[flagId] = null;
        continue;
      }
      const entry = this.byFlagKey.get(key) ?? null;
      result[flagId] = entry?.experiment ?? null;
    }
    return result;
  }
  getActiveExperimentIds(): ReadonlySet<string> {
    const experimentIds = new Set<string>();
    for (const entry of this.byFlagKey.values()) {
      if (entry.experiment) {
        experimentIds.add(entry.experiment.id);
      }
    }
    return experimentIds;
  }
  isReady(): boolean {
    return this.ready;
  }
  markReady(): void {
    this.ready = true;
  }
  reset(): void {
    this.byFlagKey.clear();
    this.flagKeyById.clear();
    this.ready = false;
  }
  apply(message: RuntimeSnapshotMessage): void {
    const generatedAtMs = new Date(message.generatedAt).getTime();
    const current = this.byFlagKey.get(message.flag.key);
    if (current && current.generatedAtMs > generatedAtMs) {
      return;
    }
    const flag: RuntimeFlagView = {
      id: message.flag.id,
      key: message.flag.key,
      valueType: message.flag.valueType,
      defaultValue: message.flag.defaultValue,
      description: message.flag.description,
      createdAt: message.flag.createdAt,
      updatedAt: message.flag.updatedAt,
    };
    const experiment = message.experiment
      ? {
          id: message.experiment.id,
          flagId: message.experiment.flagId,
          status: message.experiment.status,
          conflictDomain: message.experiment.conflictDomain,
          priority: message.experiment.priority,
          audiencePercent: message.experiment.audiencePercent,
          targetingRule: message.experiment.targetingRule ?? null,
          variants: [...message.experiment.variants]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((variant) => ({
              id: variant.id,
              value: variant.value,
              weight: variant.weight,
              isControl: variant.isControl,
            })),
        }
      : null;
    this.byFlagKey.set(message.flag.key, {
      flag,
      experiment,
      generatedAtMs: Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now(),
    });
    this.flagKeyById.set(message.flag.id, message.flag.key);
    this.ready = true;
  }
}
