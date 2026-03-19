import { telemetryReady } from '@/telemetry';

async function main(): Promise<void> {
  await telemetryReady;
  const { bootstrapHttpApp } = await import('../../bootstrap/bootstrap-http-app.js');
  const { DecideApiModule } = await import('./decide-api.module.js');

  await bootstrapHttpApp({
    rootModule: DecideApiModule,
    serviceName: 'decide-api',
    docsEnabled: true,
  });
}

void main();
