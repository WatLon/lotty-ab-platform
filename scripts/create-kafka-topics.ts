import { Kafka } from 'kafkajs';

async function main() {
  const kafka = new Kafka({
    clientId: 'topic-creator',
    brokers: (process.env.KAFKA_BROKERS ?? 'kafka:9092').split(','),
  });

  const admin = kafka.admin();
  await admin.connect();

  await admin.createTopics({
    topics: [
      { topic: 'control.domain-events',  numPartitions: 6 },
      { topic: 'decision.logs',          numPartitions: 24 },
      { topic: 'events.raw',             numPartitions: 24 },
      { topic: 'events.normalized',      numPartitions: 24 },
      { topic: 'events.attributed',      numPartitions: 24 },
      { topic: 'metric.observations',    numPartitions: 24 },
    ],
  });

  await admin.disconnect();
  console.log('Kafka topics created');
}

main();
