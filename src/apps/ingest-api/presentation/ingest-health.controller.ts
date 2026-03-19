import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InMemoryEventTypeCatalogProvider } from '@/apps/ingest-api/infrastructure/event-type-catalog.provider';
import { ClickHouseService } from '@/shared/infrastructure/clickhouse/clickhouse.service';
import { KafkaService } from '@/shared/infrastructure/kafka';
import { Public } from '@/shared/presentation/common';

interface ComponentHealth {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller()
export class IngestHealthController {
  constructor(
    @Optional()
    private readonly clickhouse?: ClickHouseService,
    @Optional()
    private readonly kafka?: KafkaService,
    @Optional()
    private readonly eventTypeCatalog?: InMemoryEventTypeCatalogProvider,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness - process is alive' })
  @ApiResponse({ status: 200 })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness - ready to ingest events with up-to-date catalog' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 503 })
  async ready() {
    const components: Record<string, ComponentHealth> = {};
    let allHealthy = true;
    const clickhouse = this.clickhouse;
    if (clickhouse) {
      components.clickhouse = await this.checkComponent(async () => {
        await clickhouse.queryJson({ query: 'SELECT 1' });
      });
    }
    const kafka = this.kafka;
    if (kafka) {
      components.kafka = await this.checkComponent(async () => {
        await kafka.isHealthy();
      });
    }
    if (this.eventTypeCatalog) {
      components.eventTypeCatalog = this.eventTypeCatalog.isReady()
        ? {
            status: 'ok',
          }
        : {
            status: 'error',
            error: 'event type catalog not ready',
          };
    }
    for (const component of Object.values(components)) {
      if (component.status === 'error') {
        allHealthy = false;
        break;
      }
    }
    const response = { status: allHealthy ? 'ok' : 'degraded', components };
    if (!allHealthy) {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }

  private async checkComponent(check: () => Promise<void>): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      await check();
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error: unknown) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'unknown',
      };
    }
  }
}
