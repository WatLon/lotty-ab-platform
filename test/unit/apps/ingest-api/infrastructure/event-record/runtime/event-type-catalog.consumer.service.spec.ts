import { describe, expect, it, vi } from 'vitest';
import { EventTypeCatalogConsumerService } from '@/apps/ingest-api/infrastructure/event-type-catalog.consumer.service';
import { InMemoryEventTypeCatalogProvider } from '@/apps/ingest-api/infrastructure/event-type-catalog.provider';
import { RuntimeEventTypeView } from '@/contracts/event-type-runtime';
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
      if (key === 'EVENT_TYPE_CATALOG_REDIS_STARTUP_TIMEOUT_MS') {
        return timeoutMs as EnvConfig[K];
      }
      throw new Error(`Unexpected config key: ${String(key)}`);
    },
  } as TypedConfigService;
}
function validPayload(): RuntimeEventTypeView {
  return {
    id: 'evt-1',
    key: 'button_clicked',
    schema: { type: 'object' },
    requiresExposure: true,
    isArchived: false,
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: null,
  };
}
describe('EventTypeCatalogConsumerService', () => {
  it('parses valid payload and rejects invalid json', () => {
    const service = new EventTypeCatalogConsumerService(
      createConfig(1000),
      new RedisClientProviderStub() as unknown as RedisClientProvider,
      new InMemoryEventTypeCatalogProvider(),
      new AppLoggerStub(),
    );
    const parsed = (
      service as unknown as {
        parse: (raw: string) => RuntimeEventTypeView | null;
      }
    ).parse(JSON.stringify(validPayload()));
    expect(parsed?.key).toBe('button_clicked');
    const invalid = (
      service as unknown as {
        parse: (raw: string) => RuntimeEventTypeView | null;
      }
    ).parse('not-json');
    expect(invalid).toBeNull();
  });
  it('delegates apply to event type catalog provider', () => {
    const catalog = new InMemoryEventTypeCatalogProvider();
    const applySpy = vi.spyOn(catalog, 'apply');
    const service = new EventTypeCatalogConsumerService(
      createConfig(1000),
      new RedisClientProviderStub() as unknown as RedisClientProvider,
      catalog,
      new AppLoggerStub(),
    );
    (
      service as unknown as {
        apply: (message: RuntimeEventTypeView) => void;
      }
    ).apply(validPayload());
    expect(applySpy).toHaveBeenCalledOnce();
    expect(catalog.getByKeys(['button_clicked']).button_clicked?.id).toBe('evt-1');
  });
});
