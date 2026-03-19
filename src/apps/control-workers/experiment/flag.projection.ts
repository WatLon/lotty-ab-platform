import { Injectable } from '@nestjs/common';
import { RuntimeFlagValueType, RuntimeSnapshotMessage } from '@/contracts/decision-runtime';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { PrismaService } from '@/shared/infrastructure/persistence';
import {
  RUNTIME_SNAPSHOT_REDIS_KEY,
  RUNTIME_SNAPSHOT_REDIS_STREAM,
} from '@/shared/infrastructure/runtime-snapshot/runtime-snapshot.constants';

@Injectable()
export class FlagProjection {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisProvider: RedisClientProvider,
    private readonly appLogger: AppLogger,
  ) {}

  async projectByExperimentId(experimentId: string): Promise<void> {
    const experiment = await this.prisma.experiment.findUnique({
      where: { id: experimentId },
      select: { flagId: true },
    });
    if (!experiment) return;

    await this.projectByFlagId(experiment.flagId);
  }

  async projectByFlagId(flagId: string): Promise<void> {
    const flag = await this.prisma.flag.findUnique({
      where: { id: flagId },
      select: {
        id: true,
        key: true,
        valueType: true,
        defaultValue: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!flag) return;

    const activeExperiments = await this.prisma.experiment.findMany({
      where: { flagId, status: { in: ['RUNNING', 'PAUSED'] } },
      select: {
        id: true,
        flagId: true,
        status: true,
        conflictDomain: true,
        priority: true,
        audiencePercent: true,
        targetingRule: true,
        updatedAt: true,
        variants: {
          orderBy: { id: 'asc' },
          select: { id: true, value: true, weight: true, isControl: true },
        },
      },
    });
    if (activeExperiments.length > 1) {
      this.appLogger.error(
        {
          event: 'flag.projection.invariant_violated',
          domain: 'infrastructure',
          operation: 'FlagProjection.projectByFlagId',
          status: 'failure',
          meta: {
            flagId,
            flagKey: flag.key,
            activeCount: activeExperiments.length,
          },
        },
        undefined,
        'multiple active experiments for one flag',
      );
    }
    const experiment = activeExperiments.length === 1 ? activeExperiments[0] : null;
    const payload: RuntimeSnapshotMessage = {
      flag: {
        id: flag.id,
        key: flag.key,
        valueType: flag.valueType as RuntimeFlagValueType,
        defaultValue: flag.defaultValue,
        description: flag.description,
        createdAt: flag.createdAt.toISOString(),
        updatedAt: flag.updatedAt?.toISOString() ?? null,
      },
      experiment: experiment
        ? {
            id: experiment.id,
            flagId: experiment.flagId,
            status: experiment.status as 'RUNNING' | 'PAUSED',
            conflictDomain: experiment.conflictDomain,
            priority: experiment.priority,
            audiencePercent: experiment.audiencePercent,
            targetingRule: experiment.targetingRule,
            variants: experiment.variants,
          }
        : null,
      generatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);

    try {
      const redis = this.redisProvider.getClient();
      await redis.hset(RUNTIME_SNAPSHOT_REDIS_KEY, flag.key, serialized);
      await redis.xadd(
        RUNTIME_SNAPSHOT_REDIS_STREAM,
        'MAXLEN',
        '~',
        '1000',
        '*',
        'flagKey',
        flag.key,
        'payload',
        serialized,
      );
    } catch (error) {
      this.appLogger.error(
        {
          event: 'flag.projection.publish_failed',
          domain: 'infrastructure',
          operation: 'FlagProjection.projectByFlagId',
          status: 'failure',
          meta: { flagId: flag.id, flagKey: flag.key },
        },
        error,
        'failed to publish flag snapshot to redis',
      );
    }
  }
}
