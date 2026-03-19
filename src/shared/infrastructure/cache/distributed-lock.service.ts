import { Injectable } from '@nestjs/common';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from './redis-client.provider';

export interface LockOptions {
  ttlSeconds: number;
  ownerId?: string;
}

export interface LockHandle {
  key: string;
  release: () => Promise<void>;
}

const LUA_RELEASE_LOCK = `
  local key = KEYS[1]
  local owner = ARGV[1]
  local current = redis.call('GET', key)
  if current == owner then
    redis.call('DEL', key)
    return 1
  end
  return 0
`;

@Injectable()
export class DistributedLockService {
  private readonly instanceId =
    `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  constructor(
    private readonly redisProvider: RedisClientProvider,
    private readonly appLogger: AppLogger,
  ) {}

  private get redis() {
    return this.redisProvider.getClient();
  }

  async tryAcquire(lockKey: string, options: LockOptions): Promise<LockHandle | null> {
    const owner = options.ownerId ?? this.instanceId;
    const fullKey = `lock:${lockKey}`;

    try {
      const acquired = await this.redis.set(fullKey, owner, 'EX', options.ttlSeconds, 'NX');
      if (acquired !== 'OK') {
        return null;
      }
      return {
        key: lockKey,
        release: async () => {
          await this.release(fullKey, owner);
        },
      };
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'infrastructure.lock.acquire_failed',
          domain: 'infrastructure',
          operation: 'DistributedLockService.tryAcquire',
          status: 'failure',
          meta: { lockKey, ttlSeconds: options.ttlSeconds },
        },
        error,
        'failed to acquire distributed lock',
      );
      return null;
    }
  }

  async withLock<T>(
    lockKey: string,
    options: LockOptions,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const handle = await this.tryAcquire(lockKey, options);
    if (!handle) {
      return null;
    }
    try {
      return await fn();
    } finally {
      await handle.release();
    }
  }

  private async release(fullKey: string, owner: string): Promise<void> {
    try {
      await this.redis.eval(LUA_RELEASE_LOCK, 1, fullKey, owner);
    } catch (_error: unknown) {
      this.appLogger.warn({
        event: 'infrastructure.lock.release_failed',
        domain: 'infrastructure',
        operation: 'DistributedLockService.release',
        status: 'failure',
        meta: { key: fullKey },
      });
    }
  }
}
