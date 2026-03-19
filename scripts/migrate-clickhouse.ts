
import 'dotenv/config';
import { createClient } from '@clickhouse/client';
import {
  buildMetricObsKafkaIngestionQueries,
  buildEventsKafkaIngestionQueries,
  buildDecisionKafkaIngestionQueries,
  CLICKHOUSE_BOOTSTRAP_BASE_QUERIES,
} from '../src/shared/infrastructure/clickhouse/clickhouse-bootstrap.queries';

async function migrate() {
  const client = createClient({
    url: process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER ?? 'lotty',
    password: process.env.CLICKHOUSE_PASSWORD ?? 'lotty',
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
  });

  const kafkaBrokers = process.env.KAFKA_BROKERS ?? 'kafka:9092';
  const kafkaGroup = process.env.CLICKHOUSE_DECISIONS_KAFKA_GROUP ?? 'clickhouse-decisions-sink';
  const eventsKafkaGroup =
    process.env.CLICKHOUSE_EVENTS_KAFKA_GROUP ?? 'clickhouse-events-attributed-sink';
  const metricObsKafkaGroup =
    process.env.CLICKHOUSE_METRIC_OBS_KAFKA_GROUP ?? 'clickhouse-metric-observations-sink';
  const kafkaConsumersRaw = process.env.CLICKHOUSE_DECISIONS_KAFKA_CONSUMERS ?? '1';
  const kafkaConsumersParsed = Number.parseInt(kafkaConsumersRaw, 10);
  const kafkaConsumers = Number.isFinite(kafkaConsumersParsed) && kafkaConsumersParsed > 0
    ? kafkaConsumersParsed
    : 1;

  const migrations = [
    ...CLICKHOUSE_BOOTSTRAP_BASE_QUERIES,
    ...buildDecisionKafkaIngestionQueries({
      brokerList: kafkaBrokers,
      groupName: kafkaGroup,
      numConsumers: kafkaConsumers,
    }),
    ...buildEventsKafkaIngestionQueries({
      brokerList: kafkaBrokers,
      groupName: eventsKafkaGroup,
      numConsumers: kafkaConsumers,
    }),
    ...buildMetricObsKafkaIngestionQueries({
      brokerList: kafkaBrokers,
      groupName: metricObsKafkaGroup,
      numConsumers: kafkaConsumers,
    }),
  ];

  for (const [index, query] of migrations.entries()) {
    console.log(`Running migration ${index + 1}/${migrations.length}...`);
    await client.command({ query });
  }

  console.log('ClickHouse migrations complete.');
  await client.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
