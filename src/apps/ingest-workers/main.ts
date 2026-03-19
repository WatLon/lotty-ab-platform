import { telemetryReady } from '@/telemetry';

async function main(): Promise<void> {
  await telemetryReady;
  const { bootstrapHttpApp } = await import('../../bootstrap/bootstrap-http-app.js');
  const { IngestWorkersModule } = await import('./ingest-workers.module.js');

  await bootstrapHttpApp({
    rootModule: IngestWorkersModule,
    serviceName: 'ingest-workers',
    docsEnabled: false,
  });
}

void main();
