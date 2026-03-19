import { Injectable } from '@nestjs/common';
import { RuntimeSnapshotProvider } from '@/apps/decide-api/application/runtime-snapshot.provider';
import {
  RuntimeExperimentView as ExperimentRuntime,
  FLAG_KEY_FORMAT,
  FLAG_KEY_MAX_LENGTH,
  FLAG_KEY_MIN_LENGTH,
  RuntimeFlagView,
} from '@/contracts/decision-runtime';

export interface RequestedFlagKey {
  rawKey: string;
  key: string;
}

export interface ResolvedFlags {
  flags: RuntimeFlagView[];
  requestedKeys: RequestedFlagKey[];
  experimentsByFlagId: Record<string, ExperimentRuntime | null>;
}

@Injectable()
export class FlagResolver {
  constructor(private readonly snapshot: RuntimeSnapshotProvider) {}
  resolve(rawKeys: string[]): ResolvedFlags {
    const requestedKeys = this.getRequestedKeys(rawKeys);
    const flags = this.getFlagsByKeyOrder(requestedKeys);
    const experimentsByFlagId = this.snapshot.getExperimentsByFlagIds(flags.map((flag) => flag.id));
    return {
      flags,
      requestedKeys,
      experimentsByFlagId,
    };
  }

  private getRequestedKeys(rawKeys: string[]): RequestedFlagKey[] {
    const requestedKeys: RequestedFlagKey[] = [];
    for (const rawKey of rawKeys) {
      const key = this.normalizeKey(rawKey);
      if (!key) continue;

      requestedKeys.push({ rawKey, key });
    }
    return requestedKeys;
  }

  private getFlagsByKeyOrder(requestedKeys: RequestedFlagKey[]): RuntimeFlagView[] {
    const uniqueKeys = new Set(requestedKeys.map(({ key }) => key));
    const lookup = this.snapshot.getFlagsByKeys(Array.from(uniqueKeys));
    const flags: RuntimeFlagView[] = [];
    for (const key of uniqueKeys) {
      const flag = lookup[key];
      if (!flag) continue;

      flags.push(flag);
    }
    return flags;
  }

  private normalizeKey(raw: string): string | null {
    const key = raw.trim();
    if (key.length < FLAG_KEY_MIN_LENGTH) return null;
    if (key.length > FLAG_KEY_MAX_LENGTH) return null;
    if (!FLAG_KEY_FORMAT.test(key)) return null;

    return key;
  }
}
