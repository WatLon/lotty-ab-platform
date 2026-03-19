import { Global, Module } from '@nestjs/common';
import { KafkaModule } from '@/shared/infrastructure/kafka';
import { OutboxRelayService } from './outbox-relay.service';

@Global()
@Module({
  imports: [KafkaModule],
  providers: [OutboxRelayService],
})
export class OutboxModule {}
