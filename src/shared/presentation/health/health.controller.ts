import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { ClickHouseService } from '@/shared/infrastructure/clickhouse/clickhouse.service';
import { KafkaService } from '@/shared/infrastructure/kafka';
import { PrismaService } from '@/shared/infrastructure/persistence';
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
export class HealthController {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly redisProvider?: RedisClientProvider,
    @Optional() private readonly clickhouse?: ClickHouseService,
    @Optional() private readonly kafka?: KafkaService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness - process is alive' })
  @ApiResponse({ status: 200 })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness - ready to accept requests' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 503 })
  async ready() {
    const components: Record<string, ComponentHealth> = {};
    let allHealthy = true;
    const prisma = this.prisma;
    if (prisma) {
      components.database = await this.checkComponent('database', async () => {
        await prisma.$queryRaw`SELECT 1`;
      });
    }
    const redisProvider = this.redisProvider;
    if (redisProvider) {
      components.redis = await this.checkComponent('redis', async () => {
        const client = redisProvider.getClient();
        await client.ping();
      });
    }
    const clickhouse = this.clickhouse;
    if (clickhouse) {
      components.clickhouse = await this.checkComponent('clickhouse', async () => {
        await clickhouse.queryJson({ query: 'SELECT 1' });
      });
    }
    const kafka = this.kafka;
    if (kafka) {
      components.kafka = await this.checkComponent('kafka', async () => {
        await kafka.isHealthy();
      });
    }
    for (const comp of Object.values(components)) {
      if (comp.status === 'error') {
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

  private async checkComponent(
    _name: string,
    check: () => Promise<void>,
  ): Promise<ComponentHealth> {
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
