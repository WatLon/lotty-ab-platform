import { PrismaClient } from '@generated/prisma/client';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TypedConfigService } from '@/shared/infrastructure/config';

const DEFAULT_DB_SCHEMA = 'public';
const SCHEMA_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(config: TypedConfigService) {
    const databaseUrl = config.get('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for Prisma-enabled services');
    }
    const schemaName = resolveSchemaName(databaseUrl);
    const connectionString = toPgConnectionString(databaseUrl);
    const poolMax = config.get('PG_POOL_MAX');
    const poolIdleTimeout = config.get('PG_POOL_IDLE_TIMEOUT_MS');
    const poolConnectionTimeout = config.get('PG_POOL_CONNECTION_TIMEOUT_MS');
    const pool = new Pool({
      connectionString,
      max: poolMax,
      idleTimeoutMillis: poolIdleTimeout,
      connectionTimeoutMillis: poolConnectionTimeout,
      options: `-c search_path=${schemaName}`,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
function resolveSchemaName(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const schema = parsed.searchParams.get('schema');
    if (!schema || !SCHEMA_NAME_PATTERN.test(schema)) {
      return DEFAULT_DB_SCHEMA;
    }
    return schema;
  } catch {
    return DEFAULT_DB_SCHEMA;
  }
}
function toPgConnectionString(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    parsed.searchParams.delete('schema');
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}
