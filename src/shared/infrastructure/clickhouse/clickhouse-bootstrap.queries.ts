import { KAFKA_TOPICS } from '@/shared/infrastructure/kafka/kafka.constants';

export const CLICKHOUSE_BOOTSTRAP_BASE_QUERIES = [
  `CREATE TABLE IF NOT EXISTS events (
    id String,
    eventId String,
    eventTypeKey String,
    eventTypeId String,
    decisionId String,
    subjectId String,
    experimentId String DEFAULT '',
    variantId String DEFAULT '',
    timestamp DateTime64(3, 'UTC'),
    receivedAt DateTime64(3, 'UTC'),
    payload String,
    attributed UInt8 DEFAULT 1,
    requiresExposure UInt8 DEFAULT 0
  )
  ENGINE = ReplacingMergeTree(receivedAt)
  PARTITION BY toYYYYMM(timestamp)
  ORDER BY (eventId)
  TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE`,

  `CREATE TABLE IF NOT EXISTS decisions (
    id String,
    subjectId String,
    flagId String,
    experimentId String DEFAULT '',
    variantId String DEFAULT '',
    value String,
    reason String,
    subjectAttributes String,
    createdAt DateTime64(3, 'UTC')
  )
  ENGINE = ReplacingMergeTree(createdAt)
  PARTITION BY toYYYYMM(createdAt)
  ORDER BY (id)
  TTL toDateTime(createdAt) + INTERVAL 90 DAY DELETE`,

  `CREATE TABLE IF NOT EXISTS metric_obs (
    observationId String,
    experimentId String,
    variantId String,
    metricKey String,
    timestamp DateTime64(3, 'UTC'),
    value Float64
  )
  ENGINE = ReplacingMergeTree(timestamp)
  PARTITION BY toYYYYMM(timestamp)
  ORDER BY (experimentId, variantId, metricKey, observationId)
  TTL toDateTime(timestamp) + INTERVAL 90 DAY DELETE`,

  `CREATE TABLE IF NOT EXISTS metric_rollups_mv (
    experimentId String,
    variantId String,
    metricKey String,
    bucket DateTime64(3, 'UTC'),
    countState AggregateFunction(count, UInt64),
    sumState AggregateFunction(sum, Float64),
    quantilesState AggregateFunction(quantiles(0.5, 0.9, 0.95, 0.99), Float64)
  )
  ENGINE = AggregatingMergeTree
  PARTITION BY toYYYYMM(bucket)
  ORDER BY (experimentId, variantId, metricKey, bucket)`,

  `DROP VIEW IF EXISTS metric_rollups_mv_view`,

  `CREATE MATERIALIZED VIEW IF NOT EXISTS metric_rollups_mv_view
  TO metric_rollups_mv
  AS
  SELECT
    experimentId,
    variantId,
    metricKey,
    toStartOfMinute(timestamp) AS bucket,
    countState(toUInt64(1)) AS countState,
    sumState(value) AS sumState,
    quantilesState(0.5, 0.9, 0.95, 0.99)(value) AS quantilesState
  FROM metric_obs
  GROUP BY experimentId, variantId, metricKey, bucket`,
];

export function buildDecisionKafkaIngestionQueries(params: {
  brokerList: string;
  groupName: string;
  numConsumers: number;
}): string[] {
  return [
    `DROP VIEW IF EXISTS decisions_kafka_mv`,
    `DROP TABLE IF EXISTS decisions_kafka`,
    `CREATE TABLE IF NOT EXISTS decisions_kafka (
      id String,
      subjectId String,
      flagId String,
      experimentId String,
      variantId String,
      value String,
      reason String,
      subjectAttributes String,
      createdAt String
    )
    ENGINE = Kafka
    SETTINGS
      kafka_broker_list = '${params.brokerList}',
      kafka_topic_list = '${KAFKA_TOPICS.DECISION_LOGS}',
      kafka_group_name = '${params.groupName}',
      kafka_format = 'JSONEachRow',
      kafka_num_consumers = ${params.numConsumers},
      kafka_skip_broken_messages = 1000`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS decisions_kafka_mv
    TO decisions
    AS
    SELECT
      id,
      subjectId,
      flagId,
      ifNull(experimentId, '') AS experimentId,
      ifNull(variantId, '') AS variantId,
      value,
      reason,
      ifNull(subjectAttributes, '') AS subjectAttributes,
      parseDateTime64BestEffort(createdAt, 3, 'UTC') AS createdAt
    FROM decisions_kafka`,
  ];
}

export function buildEventsKafkaIngestionQueries(params: {
  brokerList: string;
  groupName: string;
  numConsumers: number;
}): string[] {
  return [
    `DROP VIEW IF EXISTS events_attributed_kafka_mv`,
    `DROP TABLE IF EXISTS events_attributed_kafka`,
    `CREATE TABLE IF NOT EXISTS events_attributed_kafka (
      id String,
      eventId String,
      eventTypeKey String,
      eventTypeId String,
      decisionId String,
      subjectId String,
      experimentId String,
      variantId String,
      timestamp String,
      receivedAt String,
      payload String,
      attributed UInt8,
      requiresExposure UInt8
    )
    ENGINE = Kafka
    SETTINGS
      kafka_broker_list = '${params.brokerList}',
      kafka_topic_list = '${KAFKA_TOPICS.EVENTS_ATTRIBUTED}',
      kafka_group_name = '${params.groupName}',
      kafka_format = 'JSONEachRow',
      kafka_num_consumers = ${params.numConsumers},
      kafka_skip_broken_messages = 1000`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS events_attributed_kafka_mv
    TO events
    AS
    SELECT
      id,
      eventId,
      eventTypeKey,
      eventTypeId,
      decisionId,
      subjectId,
      ifNull(experimentId, '') AS experimentId,
      ifNull(variantId, '') AS variantId,
      parseDateTime64BestEffort(timestamp, 3, 'UTC') AS timestamp,
      parseDateTime64BestEffort(receivedAt, 3, 'UTC') AS receivedAt,
      ifNull(payload, '') AS payload,
      attributed,
      requiresExposure
    FROM events_attributed_kafka`,
  ];
}

export function buildMetricObsKafkaIngestionQueries(params: {
  brokerList: string;
  groupName: string;
  numConsumers: number;
}): string[] {
  return [
    `DROP VIEW IF EXISTS metric_obs_kafka_mv`,
    `DROP TABLE IF EXISTS metric_obs_kafka`,
    `CREATE TABLE IF NOT EXISTS metric_obs_kafka (
      observationId String,
      experimentId String,
      variantId String,
      metricKey String,
      timestamp String,
      value Float64
    )
    ENGINE = Kafka
    SETTINGS
      kafka_broker_list = '${params.brokerList}',
      kafka_topic_list = '${KAFKA_TOPICS.METRIC_OBSERVATIONS}',
      kafka_group_name = '${params.groupName}',
      kafka_format = 'JSONEachRow',
      kafka_num_consumers = ${params.numConsumers},
      kafka_skip_broken_messages = 1000`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS metric_obs_kafka_mv
    TO metric_obs
    AS
    SELECT
      observationId,
      experimentId,
      variantId,
      metricKey,
      parseDateTime64BestEffort(timestamp, 3, 'UTC') AS timestamp,
      value
    FROM metric_obs_kafka`,
  ];
}
