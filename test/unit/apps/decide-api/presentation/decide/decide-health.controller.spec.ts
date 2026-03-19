import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RuntimeSnapshotProvider } from '@/apps/decide-api/application';
import { DecideHealthController } from '@/apps/decide-api/presentation/decide-health.controller';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { KafkaService } from '@/shared/infrastructure/kafka';

async function expectDegraded(promise: Promise<unknown>): Promise<{
  status: string;
  components: Record<string, unknown>;
}> {
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
describe('DecideHealthController', () => {
  it('returns liveness payload', () => {
    const controller = new DecideHealthController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
  it('returns ready=ok when no dependencies are configured', async () => {
    const controller = new DecideHealthController();
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      components: {},
    });
  });
  it('returns ready=ok when redis/kafka/runtime-snapshot are healthy', async () => {
    const redis = {
      getClient: () => ({
        ping: async () => 'PONG',
      }),
    } as unknown as RedisClientProvider;
    const kafka = {
      isHealthy: async () => undefined,
    } as unknown as KafkaService;
    const runtimeSnapshot = {
      isReady: () => true,
    } as unknown as RuntimeSnapshotProvider;
    const controller = new DecideHealthController(redis, kafka, runtimeSnapshot);
    const response = await controller.ready();
    expect(response.status).toBe('ok');
    expect(response.components.redis?.status).toBe('ok');
    expect(response.components.kafka?.status).toBe('ok');
    expect(response.components.runtimeSnapshot).toEqual({ status: 'ok' });
  });
  it('throws degraded when any dependency is not ready or fails', async () => {
    const redis = {
      getClient: () => ({
        ping: async () => {
          throw new Error('redis ping failed');
        },
      }),
    } as unknown as RedisClientProvider;
    const kafka = {
      isHealthy: async () => {
        throw 'kafka down';
      },
    } as unknown as KafkaService;
    const runtimeSnapshot = {
      isReady: () => false,
    } as unknown as RuntimeSnapshotProvider;
    const controller = new DecideHealthController(redis, kafka, runtimeSnapshot);
    const degraded = await expectDegraded(controller.ready());
    expect(degraded.status).toBe('degraded');
    expect(
      (
        degraded.components.runtimeSnapshot as {
          status: string;
          error: string;
        }
      ).error,
    ).toBe('runtime snapshot is not ready');
    expect(
      (
        degraded.components.redis as {
          status: string;
          error: string;
        }
      ).error,
    ).toBe('redis ping failed');
    expect(
      (
        degraded.components.kafka as {
          status: string;
          error: string;
        }
      ).error,
    ).toBe('unknown');
  });
});
