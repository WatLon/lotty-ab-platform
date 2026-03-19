import { Injectable } from '@nestjs/common';
import { RuntimeSnapshotMessage } from '@/contracts/decision-runtime';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { RedisSnapshotConsumer } from '@/shared/infrastructure/cache/redis-snapshot.consumer';
import { TypedConfigService } from '@/shared/infrastructure/config';
import {
  RUNTIME_SNAPSHOT_REDIS_KEY,
  RUNTIME_SNAPSHOT_REDIS_STREAM,
} from '@/shared/infrastructure/runtime-snapshot';
import { InMemoryRuntimeSnapshotProvider } from './runtime-snapshot.provider';

@Injectable()
export class RuntimeSnapshotConsumerService extends RedisSnapshotConsumer<RuntimeSnapshotMessage> {
  protected readonly redisKey = RUNTIME_SNAPSHOT_REDIS_KEY;

  protected readonly redisStream = RUNTIME_SNAPSHOT_REDIS_STREAM;

  protected readonly startupTimeoutMs: number;

  constructor(
    config: TypedConfigService,
    redis: RedisClientProvider,
    private readonly provider: InMemoryRuntimeSnapshotProvider,
    logger: AppLogger,
  ) {
    super(redis, logger);
    this.startupTimeoutMs = config.get('RUNTIME_SNAPSHOT_REDIS_STARTUP_TIMEOUT_MS');
  }

  protected parse(raw: string): RuntimeSnapshotMessage | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  protected apply(msg: RuntimeSnapshotMessage): void {
    this.provider.apply(msg);
  }

  protected markReady(): void {
    this.provider.markReady();
  }

  protected isReady(): boolean {
    return this.provider.isReady();
  }
}
