import { telemetryReady } from '@/telemetry';

async function main(): Promise<void> {
  await telemetryReady;
  const { bootstrapHttpApp } = await import('../../bootstrap/bootstrap-http-app.js');
  const { ControlWorkersModule } = await import('./control-workers.module.js');

  await bootstrapHttpApp({
    rootModule: ControlWorkersModule,
    serviceName: 'control-workers',
    docsEnabled: false,
  });
}

void main();
