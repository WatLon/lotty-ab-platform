import { describe, expect, it, vi } from 'vitest';
import { RuntimeSnapshotConsumerService } from '@/apps/decide-api/infrastructure/runtime-snapshot.consumer.service';
import { InMemoryRuntimeSnapshotProvider } from '@/apps/decide-api/infrastructure/runtime-snapshot.provider';
import { RuntimeSnapshotMessage } from '@/contracts/decision-runtime';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { EnvConfig } from '@/shared/infrastructure/config/env.validation';
import { TypedConfigService } from '@/shared/infrastructure/config/typed-config.service';

class AppLoggerStub extends AppLogger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}
class RedisClientProviderStub {
  readonly client = {
    hgetall: async () => ({}),
    duplicate: () => ({
      on: () => undefined,
      disconnect: () => undefined,
      xread: async () => null,
    }),
  };
  getClient() {
    return this.client;
  }
}
function createConfig(timeoutMs: number): TypedConfigService {
  return {
    get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
      if (key === 'RUNTIME_SNAPSHOT_REDIS_STARTUP_TIMEOUT_MS') {
        return timeoutMs as EnvConfig[K];
      }
      throw new Error(`Unexpected config key: ${String(key)}`);
    },
  } as TypedConfigService;
}
function validSnapshot(): RuntimeSnapshotMessage {
  return {
    generatedAt: '2026-02-20T00:00:00.000Z',
    flag: {
      id: 'flag-1',
      key: 'button_color',
      valueType: 'STRING',
      defaultValue: 'green',
      description: null,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: null,
    },
    experiment: null,
  };
}
describe('RuntimeSnapshotConsumerService', () => {
  it('parses valid payload and rejects invalid json', () => {
    const service = new RuntimeSnapshotConsumerService(
      createConfig(1000),
      new RedisClientProviderStub() as unknown as RedisClientProvider,
      new InMemoryRuntimeSnapshotProvider(),
      new AppLoggerStub(),
    );
    const parsed = (
      service as unknown as {
        parse: (raw: string) => RuntimeSnapshotMessage | null;
      }
    ).parse(JSON.stringify(validSnapshot()));
    expect(parsed?.flag.key).toBe('button_color');
    const invalid = (
      service as unknown as {
        parse: (raw: string) => RuntimeSnapshotMessage | null;
      }
    ).parse('not-json');
    expect(invalid).toBeNull();
  });
  it('delegates apply to runtime snapshot provider', () => {
    const provider = new InMemoryRuntimeSnapshotProvider();
    const applySpy = vi.spyOn(provider, 'apply');
    const service = new RuntimeSnapshotConsumerService(
      createConfig(1000),
      new RedisClientProviderStub() as unknown as RedisClientProvider,
      provider,
      new AppLoggerStub(),
    );
    (
      service as unknown as {
        apply: (message: RuntimeSnapshotMessage) => void;
      }
    ).apply(validSnapshot());
    expect(applySpy).toHaveBeenCalledOnce();
    expect(provider.getFlagsByKeys(['button_color']).button_color?.id).toBe('flag-1');
  });
});
