import { Injectable } from '@nestjs/common';
import { RuntimeEventTypeView } from '@/contracts/event-type-runtime';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { RedisSnapshotConsumer } from '@/shared/infrastructure/cache/redis-snapshot.consumer';
import { TypedConfigService } from '@/shared/infrastructure/config';
import {
  EVENT_TYPE_CATALOG_REDIS_KEY,
  EVENT_TYPE_CATALOG_REDIS_STREAM,
} from '@/shared/infrastructure/event-type-catalog/event-type-catalog.constants';
import { InMemoryEventTypeCatalogProvider } from './event-type-catalog.provider';

@Injectable()
export class EventTypeCatalogConsumerService extends RedisSnapshotConsumer<RuntimeEventTypeView> {
  protected readonly redisKey = EVENT_TYPE_CATALOG_REDIS_KEY;

  protected readonly redisStream = EVENT_TYPE_CATALOG_REDIS_STREAM;

  protected readonly startupTimeoutMs: number;

  constructor(
    config: TypedConfigService,
    redis: RedisClientProvider,
    private readonly catalog: InMemoryEventTypeCatalogProvider,
    logger: AppLogger,
  ) {
    super(redis, logger);
    this.startupTimeoutMs = config.get('EVENT_TYPE_CATALOG_REDIS_STARTUP_TIMEOUT_MS');
  }

  protected parse(raw: string): RuntimeEventTypeView | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  protected apply(et: RuntimeEventTypeView): void {
    this.catalog.apply(et);
  }

  protected markReady(): void {
    this.catalog.markReady();
  }

  protected isReady(): boolean {
    return this.catalog.isReady();
  }
}
