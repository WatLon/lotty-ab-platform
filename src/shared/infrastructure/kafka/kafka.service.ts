import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { type Consumer, Kafka, logLevel, type Producer } from 'kafkajs';
import { AppLogger } from '@/shared/application';
import { TypedConfigService } from '@/shared/infrastructure/config';

export interface KafkaPublishMessage {
  topic: string;
  key?: string;
  value: unknown;
  headers?: Record<string, string>;
}

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly kafka: Kafka;

  private producer: Producer | null = null;

  private producerConnecting: Promise<Producer> | null = null;

  private readonly consumers = new Set<Consumer>();

  private readonly transactionalProducers = new Set<Producer>();

  private shuttingDown = false;

  constructor(
    private readonly config: TypedConfigService,
    private readonly logger: AppLogger,
  ) {
    const brokers = this.config
      .get('KAFKA_BROKERS')
      .split(',')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    this.kafka = new Kafka({
      clientId: this.config.get('KAFKA_CLIENT_ID'),
      brokers,
      logLevel: logLevel.NOTHING,
    });
  }

  async ensureProducer(): Promise<Producer> {
    if (this.shuttingDown) throw new Error('KafkaService is shutting down');
    if (this.producer) return this.producer;
    if (this.producerConnecting) return this.producerConnecting;

    this.producerConnecting = (async () => {
      const producer = this.kafka.producer({
        idempotent: true,
        maxInFlightRequests: 1,
        allowAutoTopicCreation: false,
        retry: { retries: 10 },
      });
      await producer.connect();
      this.producer = producer;
      return producer;
    })();

    try {
      return await this.producerConnecting;
    } finally {
      this.producerConnecting = null;
    }
  }

  async ensureTransactionalProducer(transactionalId: string): Promise<Producer> {
    if (this.shuttingDown) throw new Error('KafkaService is shutting down');

    const producer = this.kafka.producer({
      idempotent: true,
      transactionalId,
      maxInFlightRequests: 1,
      allowAutoTopicCreation: false,
      retry: { retries: 10 },
    });
    await producer.connect();
    this.transactionalProducers.add(producer);
    return producer;
  }

  async publish(message: KafkaPublishMessage): Promise<void> {
    const producer = await this.ensureProducer();
    await producer.send({
      topic: message.topic,
      acks: -1,
      messages: [
        {
          key: message.key,
          value: JSON.stringify(message.value),
          headers: message.headers,
        },
      ],
    });
  }

  async publishBatch(messages: KafkaPublishMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const producer = await this.ensureProducer();
    const byTopic = new Map<string, KafkaPublishMessage[]>();
    for (const msg of messages) {
      const bucket = byTopic.get(msg.topic);
      if (bucket) bucket.push(msg);
      else byTopic.set(msg.topic, [msg]);
    }

    for (const [topic, topicMessages] of byTopic) {
      await producer.send({
        topic,
        acks: -1,
        messages: topicMessages.map((m) => ({
          key: m.key,
          value: JSON.stringify(m.value),
          headers: m.headers,
        })),
      });
    }
  }

  async createConsumer(groupId: string): Promise<Consumer> {
    if (this.shuttingDown) throw new Error('KafkaService is shutting down');

    const consumer = this.kafka.consumer({
      groupId,
      retry: { retries: 12 },
      allowAutoTopicCreation: false,
    });
    await consumer.connect();
    this.consumers.add(consumer);
    return consumer;
  }

  async fetchTopicOffsets(topic: string): Promise<
    Array<{
      partition: number;
      offset: string;
    }>
  > {
    const admin = this.kafka.admin();
    await admin.connect();

    try {
      const offsets = await admin.fetchTopicOffsets(topic);
      return offsets.map((o) => ({ partition: o.partition, offset: o.offset }));
    } finally {
      await admin.disconnect().catch((error: unknown) => {
        this.logger.warn({
          event: 'kafka.admin.disconnect_failed',
          domain: 'infrastructure',
          operation: 'KafkaService.fetchTopicOffsets',
          status: 'failure',
          meta: { topic, error: error instanceof Error ? error.message : 'unknown' },
        });
      });
    }
  }

  async isHealthy(): Promise<void> {
    await this.ensureProducer();
  }

  private shutdownPromise: Promise<void> | null = null;
  async onModuleDestroy(): Promise<void> {
    if (this.shutdownPromise) {
      await this.shutdownPromise;
      return;
    }

    this.shuttingDown = true;
    this.shutdownPromise = this.shutdown();
    await this.shutdownPromise;
  }

  private async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.consumers).map((c) =>
        c.stop().catch((error: unknown) => {
          this.logger.warn({
            event: 'kafka.consumer.stop_failed',
            domain: 'infrastructure',
            operation: 'KafkaService.shutdown',
            status: 'failure',
            meta: { error: error instanceof Error ? error.message : 'unknown' },
          });
        }),
      ),
    );
    await Promise.all(
      Array.from(this.consumers).map((c) =>
        c.disconnect().catch((error: unknown) => {
          this.logger.warn({
            event: 'kafka.consumer.disconnect_failed',
            domain: 'infrastructure',
            operation: 'KafkaService.shutdown',
            status: 'failure',
            meta: { error: error instanceof Error ? error.message : 'unknown' },
          });
        }),
      ),
    );

    this.consumers.clear();
    if (this.producer) {
      await this.producer.disconnect().catch((error: unknown) => {
        this.logger.warn({
          event: 'kafka.producer.disconnect_failed',
          domain: 'infrastructure',
          operation: 'KafkaService.shutdown',
          status: 'failure',
          meta: { error: error instanceof Error ? error.message : 'unknown' },
        });
      });
      this.producer = null;
    }

    await Promise.all(
      Array.from(this.transactionalProducers).map((producer) =>
        producer.disconnect().catch((error: unknown) => {
          this.logger.warn({
            event: 'kafka.transactional_producer.disconnect_failed',
            domain: 'infrastructure',
            operation: 'KafkaService.shutdown',
            status: 'failure',
            meta: { error: error instanceof Error ? error.message : 'unknown' },
          });
        }),
      ),
    );

    this.transactionalProducers.clear();

    this.shuttingDown = false;
  }
}
