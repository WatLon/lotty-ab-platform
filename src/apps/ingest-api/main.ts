import { telemetryReady } from '@/telemetry';

async function main(): Promise<void> {
  await telemetryReady;
  const { bootstrapHttpApp } = await import('../../bootstrap/bootstrap-http-app.js');
  const { IngestApiModule } = await import('./ingest-api.module.js');

  await bootstrapHttpApp({
    rootModule: IngestApiModule,
    serviceName: 'ingest-api',
    docsEnabled: true,
  });
}

void main();
