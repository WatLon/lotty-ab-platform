import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { RuntimeSnapshotProvider } from '@/apps/decide-api/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { KafkaService } from '@/shared/infrastructure/kafka';
import { Public } from '@/shared/presentation/common';

interface ComponentHealth {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller()
export class DecideHealthController {
  constructor(
    @Optional()
    private readonly redisProvider?: RedisClientProvider,
    @Optional()
    private readonly kafka?: KafkaService,
    @Optional()
    private readonly runtimeSnapshotProvider?: RuntimeSnapshotProvider,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness - process is alive' })
  @ApiResponse({ status: 200 })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness - ready to serve runtime decisions' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 503 })
  async ready() {
    const components: Record<string, ComponentHealth> = {};
    let allHealthy = true;
    const redisProvider = this.redisProvider;
    if (redisProvider) {
      components.redis = await this.checkComponent(async () => {
        const client = redisProvider.getClient();
        await client.ping();
      });
    }
    const kafka = this.kafka;
    if (kafka) {
      components.kafka = await this.checkComponent(async () => {
        await kafka.isHealthy();
      });
    }
    if (this.runtimeSnapshotProvider) {
      components.runtimeSnapshot = this.runtimeSnapshotProvider.isReady()
        ? { status: 'ok' }
        : { status: 'error', error: 'runtime snapshot is not ready' };
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
