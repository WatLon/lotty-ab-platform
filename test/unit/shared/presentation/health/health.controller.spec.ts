import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { ClickHouseService } from '@/shared/infrastructure/clickhouse/clickhouse.service';
import { KafkaService } from '@/shared/infrastructure/kafka';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { HealthController } from '@/shared/presentation/health/health.controller';

async function expectDegraded(
  promise: Promise<unknown>,
): Promise<{ status: string; components: Record<string, unknown> }> {
  try {
    await promise;
    throw new Error('Expected ServiceUnavailableException');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    return (error as ServiceUnavailableException).getResponse() as {
      status: string;
      components: Record<string, unknown>;
    };
  }
}

describe('HealthController', () => {
  it('returns liveness payload', () => {
    const controller = new HealthController();

    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('returns ready=ok when no dependencies are configured', async () => {
    const controller = new HealthController();

    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      components: {},
    });
  });

  it('returns ready=ok when all dependencies are healthy', async () => {
    const prisma = {
      $queryRaw: async (_strings: TemplateStringsArray) => 1,
    } as unknown as PrismaService;
    const redis = {
      getClient: () => ({
        ping: async () => 'PONG',
      }),
    } as unknown as RedisClientProvider;
    const clickhouse = {
      queryJson: async () => [],
    } as unknown as ClickHouseService;
    const kafka = {
      isHealthy: async () => undefined,
    } as unknown as KafkaService;
    const controller = new HealthController(prisma, redis, clickhouse, kafka);

    const response = await controller.ready();

    expect(response.status).toBe('ok');
    expect(response.components.database?.status).toBe('ok');
    expect(response.components.redis?.status).toBe('ok');
    expect(response.components.clickhouse?.status).toBe('ok');
    expect(response.components.kafka?.status).toBe('ok');
  });

  it('throws degraded response when at least one dependency fails', async () => {
    const redis = {
      getClient: () => ({
        ping: async () => {
          throw new Error('redis down');
        },
      }),
    } as unknown as RedisClientProvider;
    const kafka = {
      isHealthy: async () => {
        throw 'kafka down';
      },
    } as unknown as KafkaService;
    const controller = new HealthController(undefined, redis, undefined, kafka);

    const degraded = await expectDegraded(controller.ready());

    expect(degraded.status).toBe('degraded');
    expect((degraded.components.redis as { status: string; error: string }).status).toBe('error');
    expect((degraded.components.redis as { status: string; error: string }).error).toBe(
      'redis down',
    );
    expect((degraded.components.kafka as { status: string; error: string }).status).toBe('error');
    expect((degraded.components.kafka as { status: string; error: string }).error).toBe('unknown');
  });
});
