import { Module } from '@nestjs/common';
import {
  EventTypeCatalogProvider,
  IngestEventsQueue,
  IngestEventsUseCase,
} from '@/apps/ingest-api/application';
import { IngestController } from '@/apps/ingest-api/presentation';
import { DecisionTokenSigner } from '@/contracts/decision-token';
import { KafkaModule } from '@/shared/infrastructure/kafka';
import { CryptoService } from '@/shared/infrastructure/security';
import { EventTypeCatalogConsumerService } from './event-type-catalog.consumer.service';
import { InMemoryEventTypeCatalogProvider } from './event-type-catalog.provider';
import { KafkaIngestEventsQueue } from './ingest-events.producer';

@Module({
  imports: [KafkaModule],
  controllers: [IngestController],
  providers: [
    IngestEventsUseCase,
    KafkaIngestEventsQueue,
    EventTypeCatalogConsumerService,
    InMemoryEventTypeCatalogProvider,
    { provide: DecisionTokenSigner, useExisting: CryptoService },
    { provide: IngestEventsQueue, useExisting: KafkaIngestEventsQueue },
    { provide: EventTypeCatalogProvider, useExisting: InMemoryEventTypeCatalogProvider },
  ],
})
export class IngestModule {}
