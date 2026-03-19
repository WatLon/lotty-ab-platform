import { Module } from '@nestjs/common';
import { ExperimentWorkersModule } from '@/apps/control-workers/experiment';
import { NotificationWorkersModule } from '@/apps/control-workers/notification';
import { buildHttpAppImports, HTTP_APP_PROVIDERS } from '@/bootstrap/http-app.module-config';
import { HealthController } from '@/shared/presentation/health';

@Module({
  imports: [
    ...buildHttpAppImports('control-workers'),
    ExperimentWorkersModule,
    NotificationWorkersModule,
  ],
  controllers: [HealthController],
  providers: [...HTTP_APP_PROVIDERS],
})
export class ControlWorkersModule {}
