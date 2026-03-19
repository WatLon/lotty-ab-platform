import { Injectable, OnModuleInit } from '@nestjs/common';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';
import { AppLogger } from '@/shared/application';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { NotificationDispatcher } from './notification.dispatcher';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  constructor(
    private readonly config: TypedConfigService,
    private readonly kafka: KafkaService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly appLogger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const groupId = this.config.get('NOTIFICATION_DISPATCH_GROUP_ID');
    const consumer = await this.kafka.createConsumer(groupId);
    await consumer.subscribe({ topic: KAFKA_TOPICS.CONTROL_DOMAIN_EVENTS, fromBeginning: false });
    void consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        const parsed = ControlDomainEventEnvelope.safeParse(JSON.parse(message.value.toString()));
        if (parsed.error) return;

        try {
          await this.dispatcher.dispatch(parsed.data);
        } catch (error) {
          this.appLogger.error(
            {
              event: 'notification.consumer.failed',
              domain: 'application',
              operation: 'NotificationConsumer.eachMessage',
              status: 'failure',
              meta: {
                eventName: parsed.data.eventName,
                aggregateType: parsed.data.aggregateType,
                aggregateId: parsed.data.aggregateId,
              },
            },
            error,
            'failed to dispatch notification',
          );
          throw error;
        }
      },
    });
  }
}
