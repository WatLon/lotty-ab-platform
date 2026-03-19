import { describe, expect, it } from 'vitest';
import { AppLogger } from '@/shared/application';
import { EnvConfig } from '@/shared/infrastructure/config/env.validation';
import { TypedConfigService } from '@/shared/infrastructure/config/typed-config.service';
import { KafkaService } from '@/shared/infrastructure/kafka/kafka.service';

interface ProducerStub {
  connect: () => Promise<void>;
  send: (payload: unknown) => Promise<void>;
  disconnect: () => Promise<void>;
}
interface ConsumerStub {
  connect: () => Promise<void>;
  stop: () => Promise<void>;
  disconnect: () => Promise<void>;
}
interface AdminStub {
  connect: () => Promise<void>;
  fetchTopicOffsets: (topic: string) => Promise<
    Array<{
      partition: number;
      offset: string;
    }>
  >;
  disconnect: () => Promise<void>;
}
interface KafkaServicePrivate {
  kafka: {
    producer: (options: unknown) => ProducerStub;
    consumer: (options: unknown) => ConsumerStub;
    admin: () => AdminStub;
  };
  shuttingDown: boolean;
}
class AppLoggerStub extends AppLogger {
  warns: unknown[] = [];
  info(): void {}
  warn(payload: unknown): void {
    this.warns.push(payload);
  }
  error(): void {}
  debug(): void {}
}
function createConfig(values: {
  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
}): TypedConfigService {
  return {
    get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
      return values[key as keyof typeof values] as EnvConfig[K];
    },
  } as TypedConfigService;
}
function createService(config: TypedConfigService, logger: AppLogger): KafkaService {
  return new KafkaService(config, logger);
}
describe('KafkaService', () => {
  it('connects producer once and reuses it', async () => {
    const logger = new AppLoggerStub();
    const service = createService(
      createConfig({
        KAFKA_BROKERS: 'broker-1:9092,broker-2:9092',
        KAFKA_CLIENT_ID: 'client-id',
      }),
      logger,
    );
    let producerConnectCalls = 0;
    const producerSendPayloads: unknown[] = [];
    const producerStub: ProducerStub = {
      connect: async () => {
        producerConnectCalls += 1;
      },
      send: async (payload: unknown) => {
        producerSendPayloads.push(payload);
      },
      disconnect: async () => undefined,
    };
    (service as unknown as KafkaServicePrivate).kafka = {
      producer: () => producerStub,
      consumer: () => {
        throw new Error('not used');
      },
      admin: () => {
        throw new Error('not used');
      },
    };
    const producerA = await service.ensureProducer();
    const producerB = await service.ensureProducer();
    expect(producerA as unknown).toBe(producerStub as unknown);
    expect(producerB as unknown).toBe(producerStub as unknown);
    expect(producerConnectCalls).toBe(1);
    await service.publish({
      topic: 'decisions',
      key: 'subject-1',
      value: { ok: true },
      headers: { requestId: 'r-1' },
    });
    expect(producerSendPayloads).toEqual([
      {
        topic: 'decisions',
        acks: -1,
        messages: [
          {
            key: 'subject-1',
            value: JSON.stringify({ ok: true }),
            headers: { requestId: 'r-1' },
          },
        ],
      },
    ]);
  });
  it('groups publishBatch by topic and skips empty batches', async () => {
    const logger = new AppLoggerStub();
    const service = createService(
      createConfig({
        KAFKA_BROKERS: 'broker-1:9092',
        KAFKA_CLIENT_ID: 'client-id',
      }),
      logger,
    );
    const producerSendPayloads: unknown[] = [];
    const producerStub: ProducerStub = {
      connect: async () => undefined,
      send: async (payload: unknown) => {
        producerSendPayloads.push(payload);
      },
      disconnect: async () => undefined,
    };
    (service as unknown as KafkaServicePrivate).kafka = {
      producer: () => producerStub,
      consumer: () => {
        throw new Error('not used');
      },
      admin: () => {
        throw new Error('not used');
      },
    };
    await service.publishBatch([]);
    expect(producerSendPayloads).toHaveLength(0);
    await service.publishBatch([
      { topic: 'decisions', key: 'a', value: { x: 1 } },
      { topic: 'events', key: 'b', value: { y: 2 } },
      { topic: 'decisions', key: 'c', value: { z: 3 } },
    ]);
    expect(producerSendPayloads).toHaveLength(2);
    expect(producerSendPayloads[0]).toEqual({
      topic: 'decisions',
      acks: -1,
      messages: [
        { key: 'a', value: JSON.stringify({ x: 1 }), headers: undefined },
        { key: 'c', value: JSON.stringify({ z: 3 }), headers: undefined },
      ],
    });
    expect(producerSendPayloads[1]).toEqual({
      topic: 'events',
      acks: -1,
      messages: [{ key: 'b', value: JSON.stringify({ y: 2 }), headers: undefined }],
    });
  });
  it('creates consumers and rejects operations while shutting down', async () => {
    const logger = new AppLoggerStub();
    const service = createService(
      createConfig({
        KAFKA_BROKERS: 'broker-1:9092',
        KAFKA_CLIENT_ID: 'client-id',
      }),
      logger,
    );
    const privateState = service as unknown as KafkaServicePrivate;
    let consumerConnectCalls = 0;
    const consumerStub: ConsumerStub = {
      connect: async () => {
        consumerConnectCalls += 1;
      },
      stop: async () => undefined,
      disconnect: async () => undefined,
    };
    privateState.kafka = {
      producer: () => {
        throw new Error('not used');
      },
      consumer: () => consumerStub,
      admin: () => {
        throw new Error('not used');
      },
    };
    const consumer = await service.createConsumer('group-1');
    expect(consumer as unknown).toBe(consumerStub as unknown);
    expect(consumerConnectCalls).toBe(1);
    privateState.shuttingDown = true;
    await expect(service.createConsumer('group-2')).rejects.toThrow(
      'KafkaService is shutting down',
    );
    await expect(service.ensureProducer()).rejects.toThrow('KafkaService is shutting down');
  });
  it('fetches topic offsets and warns on admin disconnect failure', async () => {
    const logger = new AppLoggerStub();
    const service = createService(
      createConfig({
        KAFKA_BROKERS: 'broker-1:9092',
        KAFKA_CLIENT_ID: 'client-id',
      }),
      logger,
    );
    let adminConnectCalls = 0;
    let adminDisconnectCalls = 0;
    const adminStub: AdminStub = {
      connect: async () => {
        adminConnectCalls += 1;
      },
      fetchTopicOffsets: async () => [
        { partition: 0, offset: '10' },
        { partition: 1, offset: '20' },
      ],
      disconnect: async () => {
        adminDisconnectCalls += 1;
      },
    };
    (service as unknown as KafkaServicePrivate).kafka = {
      producer: () => {
        throw new Error('not used');
      },
      consumer: () => {
        throw new Error('not used');
      },
      admin: () => adminStub,
    };
    const offsets = await service.fetchTopicOffsets('decisions');
    expect(offsets).toEqual([
      { partition: 0, offset: '10' },
      { partition: 1, offset: '20' },
    ]);
    expect(adminConnectCalls).toBe(1);
    expect(adminDisconnectCalls).toBe(1);
    adminStub.disconnect = async () => {
      throw new Error('disconnect failed');
    };
    await service.fetchTopicOffsets('decisions');
    expect(logger.warns.length).toBeGreaterThan(0);
  });
  it('handles shutdown flow, consumer/prod disconnect failures and repeated destroy calls', async () => {
    const logger = new AppLoggerStub();
    const service = createService(
      createConfig({
        KAFKA_BROKERS: 'broker-1:9092',
        KAFKA_CLIENT_ID: 'client-id',
      }),
      logger,
    );
    let consumerAStopCalls = 0;
    let consumerADisconnectCalls = 0;
    const consumerA: ConsumerStub = {
      connect: async () => undefined,
      stop: async () => {
        consumerAStopCalls += 1;
        throw new Error('stop failed');
      },
      disconnect: async () => {
        consumerADisconnectCalls += 1;
      },
    };
    let consumerBStopCalls = 0;
    let consumerBDisconnectCalls = 0;
    const consumerB: ConsumerStub = {
      connect: async () => undefined,
      stop: async () => {
        consumerBStopCalls += 1;
      },
      disconnect: async () => {
        consumerBDisconnectCalls += 1;
        throw new Error('disconnect failed');
      },
    };
    let producerDisconnectCalls = 0;
    const producer: ProducerStub = {
      connect: async () => undefined,
      send: async () => undefined,
      disconnect: async () => {
        producerDisconnectCalls += 1;
        throw new Error('producer disconnect failed');
      },
    };
    const consumersQueue: ConsumerStub[] = [consumerA, consumerB];
    (service as unknown as KafkaServicePrivate).kafka = {
      producer: () => producer,
      consumer: () => {
        const nextConsumer = consumersQueue.shift();
        if (!nextConsumer) {
          throw new Error('unexpected consumer request');
        }
        return nextConsumer;
      },
      admin: () => {
        throw new Error('not used');
      },
    };
    await service.createConsumer('group-a');
    await service.createConsumer('group-b');
    await service.ensureProducer();
    await service.onModuleDestroy();
    await service.onModuleDestroy();
    expect(consumerAStopCalls).toBe(1);
    expect(consumerADisconnectCalls).toBe(1);
    expect(consumerBStopCalls).toBe(1);
    expect(consumerBDisconnectCalls).toBe(1);
    expect(producerDisconnectCalls).toBe(1);
    expect(logger.warns.length).toBeGreaterThan(0);
  });
});
