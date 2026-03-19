import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SuperTest, Test as SupertestTest } from 'supertest';
import { InMemoryRuntimeSnapshotProvider } from '@/apps/decide-api/infrastructure/runtime-snapshot.provider';
import { InMemoryEventTypeCatalogProvider } from '@/apps/ingest-api/infrastructure/event-type-catalog.provider';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import { ClickHouseService } from '@/shared/infrastructure/clickhouse/clickhouse.service';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { isolateKafkaConsumerGroupsForTests } from '../support/kafka-test-env';
import { E2EAppModule } from './e2e-app.module';
import { resetFactoryCaches } from './factories';

type SupertestFactory = (app: unknown) => SuperTest<SupertestTest>;

export interface E2EContext {
  app: NestFastifyApplication;
  prisma: PrismaService;
  http: ReturnType<SupertestFactory>;
}

function disableProxyEnvForLocalHttp(): void {
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.ALL_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  delete process.env.all_proxy;
  process.env.NO_PROXY = '*';
  process.env.no_proxy = '*';
}

export async function createE2EContext(): Promise<E2EContext> {
  disableProxyEnvForLocalHttp();
  process.env.APP_SECRET ??= 'e2e-app-secret';
  process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ??= '900';
  process.env.BOOTSTRAP_ADMIN_EMAIL ??= 'admin@example.com';
  process.env.BOOTSTRAP_ADMIN_PASSWORD ??= 'SecurePass123';
  process.env.BOOTSTRAP_ADMIN_NAME ??= 'Bootstrap Admin';
  process.env.KAFKA_BROKERS ??= 'localhost:19092';
  process.env.RUNTIME_SNAPSHOT_REDIS_STARTUP_TIMEOUT_MS ??= '200';
  isolateKafkaConsumerGroupsForTests('e2e');
  const moduleBuilder = Test.createTestingModule({
    imports: [E2EAppModule],
  });
  moduleBuilder.overrideProvider(ThrottlerGuard).useValue({ canActivate: () => true });
  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  try {
    const runtimeSnapshotProvider = app.get(InMemoryRuntimeSnapshotProvider, {
      strict: false,
    });
    if (!runtimeSnapshotProvider.isReady()) {
      runtimeSnapshotProvider.markReady();
    }
  } catch {}
  try {
    const eventTypeCatalog = app.get(InMemoryEventTypeCatalogProvider, {
      strict: false,
    });
    eventTypeCatalog.markReady();
  } catch {}
  const prisma = app.get(PrismaService);
  const supertest = (await import('supertest')).default as unknown as SupertestFactory;
  return {
    app,
    prisma,
    http: supertest(app.getHttpServer()),
  };
}
export async function closeE2EContext(context: E2EContext): Promise<void> {
  await context.app.close();
}
export async function resetE2ETestDoubles(context: E2EContext): Promise<void> {
  resetFactoryCaches();
  try {
    const redisProvider = context.app.get<RedisClientProvider>(RedisClientProvider, {
      strict: false,
    });
    const redis = redisProvider?.getClient() as
      | {
          flushdb?: () => Promise<unknown>;
          call?: (...args: string[]) => Promise<unknown>;
        }
      | undefined;
    if (redis?.flushdb) {
      await redis.flushdb();
    } else if (redis?.call) {
      await redis.call('FLUSHDB');
    }
  } catch {}
  try {
    const runtimeSnapshotProvider = context.app.get(InMemoryRuntimeSnapshotProvider, {
      strict: false,
    });
    runtimeSnapshotProvider.reset();
    runtimeSnapshotProvider.markReady();
  } catch {}
  try {
    const eventTypeCatalog = context.app.get(InMemoryEventTypeCatalogProvider, {
      strict: false,
    });
    eventTypeCatalog.reset();
    eventTypeCatalog.markReady();
  } catch {}
  try {
    const clickhouse = context.app.get(ClickHouseService, { strict: false });
    await clickhouse.command('TRUNCATE TABLE IF EXISTS metric_rollups_mv');
    await clickhouse.command('TRUNCATE TABLE IF EXISTS metric_obs');
    await clickhouse.command('TRUNCATE TABLE IF EXISTS events');
    await clickhouse.command('TRUNCATE TABLE IF EXISTS decisions');
  } catch {}
}
