import { Module } from '@nestjs/common';
import { DecisionModule } from '@/apps/decide-api/infrastructure';
import { DecideHealthController } from '@/apps/decide-api/presentation';
import { buildHttpAppImports, HTTP_APP_PROVIDERS } from '@/bootstrap/http-app.module-config';

@Module({
  imports: [...buildHttpAppImports('decide-api'), DecisionModule],
  controllers: [DecideHealthController],
  providers: [...HTTP_APP_PROVIDERS],
})
export class DecideApiModule {}
