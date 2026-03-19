import { Injectable } from '@nestjs/common';
import {
  ParticipationLimiter,
  SubjectParticipationState,
} from '@/apps/decide-api/application/subject-participation/participation-limiter';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';

@Injectable()
export class RedisParticipationLimiter implements ParticipationLimiter {
  private static readonly STATE_TTL = 30 * 24 * 60 * 60;

  private static readonly EXP_PREFIX = 'exp:';

  constructor(
    private readonly redisProvider: RedisClientProvider,
    private readonly appLogger: AppLogger,
  ) {}

  private get redis() {
    return this.redisProvider.getClient();
  }

  async getState(subjectId: string): Promise<SubjectParticipationState> {
    try {
      const fields = await this.redis.hgetall(`subject_state:${subjectId}`);
      if (Object.keys(fields).length === 0) return this.empty();

      const activeExperiments = new Map<string, string | null>();
      for (const [key, value] of Object.entries(fields)) {
        if (!key.startsWith(RedisParticipationLimiter.EXP_PREFIX)) continue;

        activeExperiments.set(
          key.slice(RedisParticipationLimiter.EXP_PREFIX.length),
          value || null,
        );
      }
      return {
        version: this.int(fields.v),
        activeExperiments,
        meta: {
          windowStartMs: this.int(fields['meta:windowStartMs']),
          assignmentsInWindow: this.int(fields['meta:assignmentsInWindow']),
          cooldownUntilMs: this.int(fields['meta:cooldownUntilMs']),
        },
      };
    } catch {
      this.appLogger.warn({
        event: 'infrastructure.cache.read_failed',
        domain: 'infrastructure',
        operation: 'ParticipationLimiter.getState',
        status: 'failure',
        meta: { subjectId },
      });
      return this.empty();
    }
  }

  async putIfVersion(
    subjectId: string,
    expectedVersion: number,
    nextState: SubjectParticipationState,
  ): Promise<boolean> {
    const serialized: string[] = [
      'v',
      String(nextState.version),
      'meta:windowStartMs',
      String(nextState.meta.windowStartMs),
      'meta:assignmentsInWindow',
      String(nextState.meta.assignmentsInWindow),
      'meta:cooldownUntilMs',
      String(nextState.meta.cooldownUntilMs),
    ];
    for (const [experimentId, domain] of nextState.activeExperiments) {
      serialized.push(`${RedisParticipationLimiter.EXP_PREFIX}${experimentId}`, domain ?? '');
    }
    try {
      const result = await this.redis.eval(
        LUA_COMPARE_AND_SET,
        1,
        `subject_state:${subjectId}`,
        String(expectedVersion),
        String(RedisParticipationLimiter.STATE_TTL),
        ...serialized,
      );
      return Number(result) === 1;
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'infrastructure.cache.write_failed',
          domain: 'infrastructure',
          operation: 'ParticipationLimiter.putIfVersion',
          status: 'failure',
          meta: { subjectId, expectedVersion },
        },
        error,
        'failed to compare-and-set subject participation state',
      );
      return false;
    }
  }

  async removeExperimentForSubjects(experimentId: string, subjectIds: string[]): Promise<void> {
    if (subjectIds.length === 0) return;

    const field = `${RedisParticipationLimiter.EXP_PREFIX}${experimentId}`;

    try {
      const multi = this.redis.multi();
      for (const subjectId of subjectIds) {
        multi.hdel(`subject_state:${subjectId}`, field);
      }
      await multi.exec();
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'infrastructure.cache.batch_remove_failed',
          domain: 'infrastructure',
          operation: 'ParticipationLimiter.removeExperimentForSubjects',
          status: 'failure',
          meta: { experimentId, subjectsCount: subjectIds.length },
        },
        error,
        'failed to remove experiment from subject states',
      );
    }
  }

  private empty(): SubjectParticipationState {
    return {
      version: 0,
      activeExperiments: new Map(),
      meta: { windowStartMs: 0, assignmentsInWindow: 0, cooldownUntilMs: 0 },
    };
  }

  private int(value: string | undefined): number {
    if (!value) return 0;

    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }
}
const LUA_COMPARE_AND_SET = `
  local key = KEYS[1]
  local expectedVersion = ARGV[1]
  local ttlSeconds = tonumber(ARGV[2])
  local currentVersion = redis.call('HGET', key, 'v')

  if currentVersion == false then
    currentVersion = '0'
  end

  if tostring(currentVersion) ~= tostring(expectedVersion) then
    return 0
  end

  redis.call('DEL', key)

  if #ARGV > 2 then
    redis.call('HSET', key, unpack(ARGV, 3))
    redis.call('EXPIRE', key, ttlSeconds)
  end

  return 1
`;
