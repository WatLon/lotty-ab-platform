import { Module } from '@nestjs/common';
import { buildHttpAppImports, HTTP_APP_PROVIDERS } from '@/bootstrap/http-app.module-config';
import { HealthController } from '@/shared/presentation/health';
import { AttributionConsumer } from './attribution.consumer';
import { DeduplicationConsumer } from './deduplication.consumer';

@Module({
  imports: [...buildHttpAppImports('ingest-workers')],
  controllers: [HealthController],
  providers: [...HTTP_APP_PROVIDERS, DeduplicationConsumer, AttributionConsumer],
})
export class IngestWorkersModule {}
