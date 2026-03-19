import type {
  RuntimeExperimentView as ExperimentRuntime,
  RuntimeFlagView,
} from '@/contracts/decision-runtime';
export abstract class RuntimeSnapshotProvider {
  abstract getFlagsByKeys(keys: string[]): Record<string, RuntimeFlagView | null>;
  abstract getExperimentsByFlagIds(flagIds: string[]): Record<string, ExperimentRuntime | null>;
  abstract getActiveExperimentIds(): ReadonlySet<string>;
  abstract isReady(): boolean;
}
