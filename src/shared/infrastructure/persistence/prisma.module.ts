import { Global, Module } from '@nestjs/common';
import { TransactionManager } from '@/shared/application';
import { AppConfigModule } from '@/shared/infrastructure/config';
import { DomainEventOutboxEnvelopeMapper } from './domain-event-outbox-envelope.mapper';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager } from './prisma-transaction-manager';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    PrismaService,
    DomainEventOutboxEnvelopeMapper,
    PrismaTransactionManager,
    { provide: TransactionManager, useExisting: PrismaTransactionManager },
  ],
  exports: [
    PrismaService,
    TransactionManager,
    PrismaTransactionManager,
    DomainEventOutboxEnvelopeMapper,
  ],
})
export class PrismaModule {}
