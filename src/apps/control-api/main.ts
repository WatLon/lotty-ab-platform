import { telemetryReady } from '@/telemetry';
import '@/apps/control-api/presentation/auth/errors/auth.schemas';
import '@/apps/control-api/presentation/approver-group/errors/approver-group.schemas';
import '@/apps/control-api/presentation/experiment/errors/experiment.schemas';
import '@/apps/control-api/presentation/experiment/errors/guardrail.schemas';
import '@/apps/control-api/presentation/flag/errors/flag.schemas';
import '@/apps/control-api/presentation/metric/errors/metric.schemas';
import '@/apps/control-api/presentation/user/errors/user.schemas';

async function main(): Promise<void> {
  await telemetryReady;
  const { bootstrapHttpApp } = await import('../../bootstrap/bootstrap-http-app.js');
  const { ControlApiModule } = await import('./control-api.module.js');

  await bootstrapHttpApp({
    rootModule: ControlApiModule,
    serviceName: 'control-api',
    docsEnabled: true,
  });
}

void main();
