import { Module } from '@nestjs/common';
import { ControlApiModule } from '@/apps/control-api/control-api.module';
import { GuardrailWorkersModule } from '@/apps/control-api/infrastructure/guardrail/guardrails';
import { NotificationWorkersModule } from '@/apps/control-workers/notification';
import { DecisionModule } from '@/apps/decide-api/infrastructure';
import { IngestModule } from '@/apps/ingest-api/infrastructure';
import { AttributionConsumer } from '@/apps/ingest-workers/attribution.consumer';
import { DeduplicationConsumer } from '@/apps/ingest-workers/deduplication.consumer';
import { NoopLoggingModule } from './noop-logging.module';
@Module({
  imports: [
    NoopLoggingModule,
    ControlApiModule,
    DecisionModule,
    IngestModule,
    GuardrailWorkersModule,
    NotificationWorkersModule,
  ],
  providers: [DeduplicationConsumer, AttributionConsumer],
})
export class E2EAppModule {}
