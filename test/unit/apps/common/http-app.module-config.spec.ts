import { InjectionToken, Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { buildHttpAppImports, HTTP_APP_PROVIDERS } from '@/bootstrap/http-app.module-config';
import { CacheModule } from '@/shared/infrastructure/cache/cache.module';
import { ClickHouseModule } from '@/shared/infrastructure/clickhouse/clickhouse.module';
import { AppConfigModule } from '@/shared/infrastructure/config';
import { KafkaModule } from '@/shared/infrastructure/kafka';
import { AppLoggingModule } from '@/shared/infrastructure/logging';
import { PrismaModule } from '@/shared/infrastructure/persistence';
import { SecurityModule } from '@/shared/infrastructure/security';
import { DomainErrorFilter } from '@/shared/presentation/common/filters';
import { LoggingInterceptor } from '@/shared/presentation/common/interceptors';
import { MetricsModule } from '@/shared/presentation/metrics';

describe('http-app.module-config', () => {
  it('builds control-api imports with expected base and profile modules', () => {
    const imports = buildHttpAppImports('control-api');

    expect(imports).toContain(AppConfigModule);
    expect(imports).toContain(AppLoggingModule);
    expect(imports).toContain(MetricsModule);
    expect(imports).toContain(PrismaModule);
    expect(imports).toContain(SecurityModule);
    expect(imports).toContain(CacheModule);
    expect(imports).toContain(ClickHouseModule);
    expect(imports).not.toContain(KafkaModule);
  });

  it('builds decide-api imports without prisma and with kafka/cache', () => {
    const imports = buildHttpAppImports('decide-api');

    expect(imports).toContain(SecurityModule);
    expect(imports).toContain(CacheModule);
    expect(imports).toContain(KafkaModule);
    expect(imports).not.toContain(ClickHouseModule);
    expect(imports).not.toContain(PrismaModule);
  });

  it('builds ingest-workers imports without prisma and with clickhouse/kafka/cache', () => {
    const imports = buildHttpAppImports('ingest-workers');

    expect(imports).toContain(SecurityModule);
    expect(imports).toContain(CacheModule);
    expect(imports).toContain(ClickHouseModule);
    expect(imports).toContain(KafkaModule);
    expect(imports).not.toContain(PrismaModule);
  });

  it('exports global provider bindings for filter/guard/pipe/interceptor', () => {
    const objectProviders = HTTP_APP_PROVIDERS.filter(
      (provider): provider is Extract<Provider, { provide: unknown }> =>
        typeof provider === 'object' && provider !== null && 'provide' in provider,
    );
    const providersByToken = new Map(
      objectProviders.map((provider) => [provider.provide, provider]),
    );
    const useClassOf = (token: InjectionToken) =>
      (providersByToken.get(token) as { useClass?: unknown } | undefined)?.useClass;

    expect(useClassOf(APP_FILTER)).toBe(DomainErrorFilter);
    expect(useClassOf(APP_GUARD)).toBeDefined();
    expect(useClassOf(APP_PIPE)).toBeDefined();
    expect(useClassOf(APP_INTERCEPTOR)).toBe(LoggingInterceptor);
  });
});
