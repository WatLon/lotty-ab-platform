import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { InMemoryEventTypeCatalogProvider } from '@/apps/ingest-api/infrastructure/event-type-catalog.provider';
import { IngestHealthController } from '@/apps/ingest-api/presentation/ingest-health.controller';
import { ClickHouseService } from '@/shared/infrastructure/clickhouse/clickhouse.service';
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
describe('IngestHealthController', () => {
  it('returns liveness payload', () => {
    const controller = new IngestHealthController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
  it('returns ready=ok when no dependencies are configured', async () => {
    const controller = new IngestHealthController();
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      components: {},
    });
  });
  it('returns ready=ok when clickhouse/kafka/catalog are healthy', async () => {
    const clickhouse = {
      queryJson: async () => [{ value: 1 }],
    } as unknown as ClickHouseService;
    const kafka = {
      isHealthy: async () => undefined,
    } as unknown as KafkaService;
    const catalog = {
      isReady: () => true,
    } as unknown as InMemoryEventTypeCatalogProvider;
    const controller = new IngestHealthController(clickhouse, kafka, catalog);
    const response = await controller.ready();
    expect(response.status).toBe('ok');
    expect(response.components.clickhouse?.status).toBe('ok');
    expect(response.components.kafka?.status).toBe('ok');
    expect(response.components.eventTypeCatalog).toEqual({ status: 'ok' });
  });
  it('throws degraded when any dependency is not ready or fails', async () => {
    const clickhouse = {
      queryJson: async () => {
        throw new Error('clickhouse unavailable');
      },
    } as unknown as ClickHouseService;
    const kafka = {
      isHealthy: async () => {
        throw 'kafka unavailable';
      },
    } as unknown as KafkaService;
    const catalog = {
      isReady: () => false,
    } as unknown as InMemoryEventTypeCatalogProvider;
    const controller = new IngestHealthController(clickhouse, kafka, catalog);
    const degraded = await expectDegraded(controller.ready());
    expect(degraded.status).toBe('degraded');
    expect(
      (
        degraded.components.clickhouse as {
          status: string;
          error: string;
        }
      ).error,
    ).toBe('clickhouse unavailable');
    expect(
      (
        degraded.components.kafka as {
          status: string;
          error: string;
        }
      ).error,
    ).toBe('unknown');
    expect(
      (
        degraded.components.eventTypeCatalog as {
          status: string;
          error: string;
        }
      ).error,
    ).toBe('event type catalog not ready');
  });
});
