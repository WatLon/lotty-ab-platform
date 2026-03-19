import { Provider } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { CacheModule } from '@/shared/infrastructure/cache/cache.module';
import { ClickHouseModule } from '@/shared/infrastructure/clickhouse/clickhouse.module';
import { AppConfigModule, TypedConfigService } from '@/shared/infrastructure/config';
import { KafkaModule } from '@/shared/infrastructure/kafka';
import { AppLoggingModule, createPinoConfig } from '@/shared/infrastructure/logging';
import { PrismaModule } from '@/shared/infrastructure/persistence';
import { SecurityModule } from '@/shared/infrastructure/security';
import { DomainErrorFilter } from '@/shared/presentation/common/filters';
import { LoggingInterceptor } from '@/shared/presentation/common/interceptors';
import { MetricsModule } from '@/shared/presentation/metrics';

export type AppProfile =
  | 'control-api'
  | 'decide-api'
  | 'ingest-api'
  | 'control-workers'
  | 'ingest-workers';

type NestAppImport = NonNullable<ModuleMetadata['imports']>[number];

function createBaseHttpAppImports(): NestAppImport[] {
  return [
    AppConfigModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: createPinoConfig,
      inject: [TypedConfigService],
    }),
    AppLoggingModule,
    MetricsModule,
  ];
}

const PROFILE_IMPORTS: Record<AppProfile, NestAppImport[]> = {
  'control-api': [PrismaModule, SecurityModule, CacheModule, ClickHouseModule],
  'decide-api': [SecurityModule, CacheModule, KafkaModule],
  'ingest-api': [SecurityModule, CacheModule, ClickHouseModule],
  'control-workers': [PrismaModule, SecurityModule, CacheModule, ClickHouseModule, KafkaModule],
  'ingest-workers': [SecurityModule, CacheModule, ClickHouseModule, KafkaModule],
};

export function buildHttpAppImports(profile: AppProfile): NestAppImport[] {
  const profileImports = PROFILE_IMPORTS[profile];
  if (!profileImports) {
    throw new Error(`Unknown app profile: ${profile}`);
  }
  return [...createBaseHttpAppImports(), ...profileImports];
}

export const HTTP_APP_PROVIDERS: Provider[] = [
  { provide: APP_FILTER, useClass: DomainErrorFilter },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  { provide: APP_PIPE, useClass: ZodValidationPipe },
  { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
];
