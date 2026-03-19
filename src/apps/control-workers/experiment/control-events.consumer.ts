import { Injectable, OnModuleInit } from '@nestjs/common';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';
import { AppLogger } from '@/shared/application';
import { toError } from '@/shared/domain/common';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { KAFKA_TOPICS, KafkaService } from '@/shared/infrastructure/kafka';
import { EventTypeProjection } from './event-type.projection';
import { FlagProjection } from './flag.projection';

@Injectable()
export class ControlEventsConsumer implements OnModuleInit {
  constructor(
    private readonly config: TypedConfigService,
    private readonly kafka: KafkaService,
    private readonly flagProjection: FlagProjection,
    private readonly eventTypeProjection: EventTypeProjection,
    private readonly appLogger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const groupId = this.config.get('EXPERIMENT_PROJECTION_GROUP_ID');
    const consumer = await this.kafka.createConsumer(groupId);
    await consumer.subscribe({ topic: KAFKA_TOPICS.CONTROL_DOMAIN_EVENTS, fromBeginning: true });
    void consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        const parsed = ControlDomainEventEnvelope.safeParse(JSON.parse(message.value.toString()));
        if (!parsed.success) return;

        try {
          switch (parsed.data.aggregateType) {
            case 'Experiment':
              await this.flagProjection.projectByExperimentId(parsed.data.aggregateId);
              break;
            case 'Flag':
              await this.flagProjection.projectByFlagId(parsed.data.aggregateId);
              break;
            case 'EventType':
              await this.eventTypeProjection.project(parsed.data.aggregateId);
              break;
          }
        } catch (error) {
          this.appLogger.error(
            {
              event: 'projection.failed',
              domain: 'infrastructure',
              operation: 'ControlEventsConsumer.eachMessage',
              status: 'failure',
              meta: {
                aggregateId: parsed.data.aggregateId,
                aggregateType: parsed.data.aggregateType,
              },
            },
            error,
            'failed to update projection from control event',
          );
          throw toError(error);
        }
      },
    });
  }
}
