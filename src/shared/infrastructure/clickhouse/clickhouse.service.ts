import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '@/shared/application';
import { toError } from '@/shared/domain/common';
import { TypedConfigService } from '@/shared/infrastructure/config/typed-config.service';

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private client: ClickHouseClient | null = null;

  constructor(
    private readonly config: TypedConfigService,
    private readonly appLogger: AppLogger,
  ) {}

  private get ch(): ClickHouseClient {
    if (!this.client) {
      throw new Error('ClickHouse client not initialized');
    }
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get('CLICKHOUSE_HOST');
    const username = this.config.get('CLICKHOUSE_USER');
    const password = this.config.get('CLICKHOUSE_PASSWORD');
    const database = this.config.get('CLICKHOUSE_DATABASE');

    this.client = createClient({ url, username, password, database });

    try {
      await this.ch.query({ query: 'SELECT 1', format: 'JSONEachRow' });
    } catch (error: unknown) {
      this.appLogger.error(
        {
          event: 'infrastructure.clickhouse.init.failed',
          domain: 'infrastructure',
          operation: 'ClickHouseService.onModuleInit',
          status: 'failure',
        },
        error,
        'clickhouse connectivity check failed',
      );
      throw toError(error);
    }
  }

  async command(query: string): Promise<void> {
    await this.ch.command({ query });
  }

  async insert(params: {
    table: string;
    values: Record<string, unknown>[];
    clickhouseSettings?: Record<string, string | number>;
  }): Promise<void> {
    if (params.values.length === 0) return;

    await this.ch.insert({
      table: params.table,
      values: params.values,
      format: 'JSONEachRow',
      clickhouse_settings: params.clickhouseSettings,
    });
  }

  async queryJson<T = Record<string, unknown>>(params: {
    query: string;
    query_params?: Record<string, unknown>;
  }): Promise<T[]> {
    const result = await this.ch.query({
      query: params.query,
      query_params: params.query_params,
      format: 'JSONEachRow',
    });
    return (await result.json()) as T[];
  }
}
