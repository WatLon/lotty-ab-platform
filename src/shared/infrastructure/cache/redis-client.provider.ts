import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppLogger } from '@/shared/application';
import { TypedConfigService } from '@/shared/infrastructure/config';

@Injectable()
export class RedisClientProvider implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(
    private readonly config: TypedConfigService,
    private readonly logger: AppLogger,
  ) {}

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    return this.client;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get('REDIS_URL');

    this.client = new Redis(url, {
      enableAutoPipelining: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('error', (err) => {
      this.logger.error(
        {
          event: 'redis.client.connection_error',
          domain: 'infrastructure',
          operation: this.constructor.name,
          status: 'failure',
          meta: { error: err.message },
        },
        err,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;

    const c = this.client;
    this.client = null;

    await c.quit();
  }
}
