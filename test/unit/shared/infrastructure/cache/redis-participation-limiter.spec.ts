import { describe, expect, it } from 'vitest';
import { RedisParticipationLimiter } from '@/apps/decide-api/infrastructure/subject-participation/redis-participation-limiter';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';

class AppLoggerStub extends AppLogger {
  warns: unknown[] = [];
  errors: unknown[] = [];
  info(): void {}
  debug(): void {}
  warn(payload: unknown): void {
    this.warns.push(payload);
  }
  error(payload: unknown): void {
    this.errors.push(payload);
  }
}
class RedisMultiStub {
  hdelCalls: Array<{
    key: string;
    field: string;
  }> = [];
  execError: Error | null = null;
  hdel(key: string, field: string): this {
    this.hdelCalls.push({ key, field });
    return this;
  }
  async exec(): Promise<unknown[]> {
    if (this.execError) {
      throw this.execError;
    }
    return [];
  }
}
class RedisClientProviderStub {
  hgetallResult: Record<string, string> = {};
  hgetallError: Error | null = null;
  evalResult: unknown = 1;
  evalError: Error | null = null;
  evalCalls: unknown[][] = [];
  multiStub = new RedisMultiStub();
  readonly client = {
    hgetall: async () => {
      if (this.hgetallError) {
        throw this.hgetallError;
      }
      return this.hgetallResult;
    },
    eval: async (...args: unknown[]) => {
      this.evalCalls.push(args);
      if (this.evalError) {
        throw this.evalError;
      }
      return this.evalResult;
    },
    multi: () => this.multiStub,
  };
  getClient() {
    return this.client;
  }
}
function setup() {
  const redis = new RedisClientProviderStub();
  const logger = new AppLoggerStub();
  const limiter = new RedisParticipationLimiter(redis as unknown as RedisClientProvider, logger);
  return { limiter, redis, logger };
}
describe('RedisParticipationLimiter', () => {
  it('returns empty state and logs warning when getState fails', async () => {
    const { limiter, redis, logger } = setup();
    redis.hgetallError = new Error('redis down');
    const state = await limiter.getState('subject-1');
    expect(state.version).toBe(0);
    expect(state.activeExperiments.size).toBe(0);
    expect(state.meta.assignmentsInWindow).toBe(0);
    expect(logger.warns.length).toBeGreaterThan(0);
  });
  it('parses state fields and ignores non-experiment keys', async () => {
    const { limiter, redis } = setup();
    redis.hgetallResult = {
      v: '3',
      'meta:windowStartMs': '200',
      'meta:assignmentsInWindow': '2',
      'meta:cooldownUntilMs': 'not-number',
      'exp:exp-1': 'checkout',
      'exp:exp-2': '',
      unknown: 'ignore',
    };
    const state = await limiter.getState('subject-1');
    expect(state.version).toBe(3);
    expect(state.meta).toEqual({
      windowStartMs: 200,
      assignmentsInWindow: 2,
      cooldownUntilMs: 0,
    });
    expect(state.activeExperiments.get('exp-1')).toBe('checkout');
    expect(state.activeExperiments.get('exp-2')).toBeNull();
  });
  it('performs compare-and-set writes and returns boolean by LUA result', async () => {
    const { limiter, redis } = setup();
    const nextState = {
      version: 4,
      activeExperiments: new Map([
        ['exp-1', 'checkout'],
        ['exp-2', null],
      ]),
      meta: {
        windowStartMs: 900,
        assignmentsInWindow: 3,
        cooldownUntilMs: 1200,
      },
    };
    redis.evalResult = 1;
    const okResult = await limiter.putIfVersion('subject-1', 3, nextState);
    expect(okResult).toBe(true);
    redis.evalResult = 0;
    const failedResult = await limiter.putIfVersion('subject-1', 3, nextState);
    expect(failedResult).toBe(false);
    const evalArgs = redis.evalCalls[0] ?? [];
    expect(evalArgs.slice(0, 5)).toEqual([
      expect.any(String),
      1,
      'subject_state:subject-1',
      '3',
      String(30 * 24 * 60 * 60),
    ]);
    expect(evalArgs).toContain('exp:exp-1');
    expect(evalArgs).toContain('checkout');
    expect(evalArgs).toContain('exp:exp-2');
    expect(evalArgs).toContain('');
  });
  it('returns false and logs error when compare-and-set write fails', async () => {
    const { limiter, redis, logger } = setup();
    redis.evalError = new Error('write failed');
    const result = await limiter.putIfVersion('subject-1', 1, {
      version: 2,
      activeExperiments: new Map(),
      meta: {
        windowStartMs: 0,
        assignmentsInWindow: 0,
        cooldownUntilMs: 0,
      },
    });
    expect(result).toBe(false);
    expect(logger.errors.length).toBeGreaterThan(0);
  });
  it('skips removeExperimentForSubjects when subjectIds is empty', async () => {
    const { limiter, redis } = setup();
    await limiter.removeExperimentForSubjects('exp-1', []);
    expect(redis.multiStub.hdelCalls).toHaveLength(0);
  });
  it('removes experiments for all subject IDs and handles batch errors', async () => {
    const { limiter, redis, logger } = setup();
    await limiter.removeExperimentForSubjects('exp-1', ['u1', 'u2']);
    expect(redis.multiStub.hdelCalls).toEqual([
      { key: 'subject_state:u1', field: 'exp:exp-1' },
      { key: 'subject_state:u2', field: 'exp:exp-1' },
    ]);
    redis.multiStub.hdelCalls = [];
    redis.multiStub.execError = new Error('exec failed');
    await limiter.removeExperimentForSubjects('exp-2', ['u3']);
    expect(logger.errors.length).toBeGreaterThan(0);
  });
});
