import { describe, expect, it } from 'vitest';
import { AppLogger } from '@/shared/application';
import { DistributedLockService } from '@/shared/infrastructure/cache/distributed-lock.service';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';

class AppLoggerStub extends AppLogger {
  warnings: unknown[] = [];

  errors: unknown[] = [];

  info(): void {}

  debug(): void {}

  warn(payload: unknown): void {
    this.warnings.push(payload);
  }

  error(payload: unknown): void {
    this.errors.push(payload);
  }
}

class RedisClientProviderStub {
  setResult: 'OK' | null = 'OK';

  setError: Error | null = null;

  evalError: Error | null = null;

  setCalls: unknown[][] = [];

  evalCalls: unknown[][] = [];

  readonly client = {
    set: async (...args: unknown[]) => {
      this.setCalls.push(args);
      if (this.setError) {
        throw this.setError;
      }
      return this.setResult;
    },
    eval: async (...args: unknown[]) => {
      this.evalCalls.push(args);
      if (this.evalError) {
        throw this.evalError;
      }
      return 1;
    },
  };

  getClient() {
    return this.client;
  }
}

function setup() {
  const redis = new RedisClientProviderStub();
  const logger = new AppLoggerStub();
  const service = new DistributedLockService(redis as unknown as RedisClientProvider, logger);
  return { service, redis, logger };
}

describe('DistributedLockService', () => {
  it('returns null when lock is not acquired', async () => {
    const { service, redis } = setup();
    redis.setResult = null;

    const handle = await service.tryAcquire('job', { ttlSeconds: 30 });

    expect(handle).toBeNull();
  });

  it('logs and returns null when lock acquire throws', async () => {
    const { service, redis, logger } = setup();
    redis.setError = new Error('redis down');

    const handle = await service.tryAcquire('job', { ttlSeconds: 30 });

    expect(handle).toBeNull();
    expect(logger.errors.length).toBeGreaterThan(0);
  });

  it('acquires and releases lock, and logs warning when release fails', async () => {
    const { service, redis, logger } = setup();

    const handle = await service.tryAcquire('job', { ttlSeconds: 30, ownerId: 'owner-1' });
    expect(handle).not.toBeNull();
    expect(handle?.key).toBe('job');
    expect(redis.setCalls[0]).toEqual(['lock:job', 'owner-1', 'EX', 30, 'NX']);

    await handle?.release();
    expect(redis.evalCalls[0]?.slice(1)).toEqual([1, 'lock:job', 'owner-1']);

    redis.evalError = new Error('release failed');
    await handle?.release();
    expect(logger.warnings.length).toBeGreaterThan(0);
  });

  it('withLock returns null when lock is unavailable', async () => {
    const { service, redis } = setup();
    redis.setResult = null;

    const result = await service.withLock('job', { ttlSeconds: 30 }, async () => 'done');

    expect(result).toBeNull();
  });

  it('withLock executes callback and releases lock on success', async () => {
    const { service, redis } = setup();

    const result = await service.withLock(
      'job',
      { ttlSeconds: 30, ownerId: 'owner-2' },
      async () => {
        return 'done';
      },
    );

    expect(result).toBe('done');
    expect(redis.evalCalls).toHaveLength(1);
  });

  it('withLock releases lock even when callback throws', async () => {
    const { service, redis } = setup();

    await expect(
      service.withLock('job', { ttlSeconds: 30, ownerId: 'owner-3' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(redis.evalCalls).toHaveLength(1);
  });
});
