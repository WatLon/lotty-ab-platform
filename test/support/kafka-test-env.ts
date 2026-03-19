import { randomUUID } from 'node:crypto';
import { resetEnvCacheForTests } from '@/shared/infrastructure/config';

const KAFKA_GROUP_ENV_KEYS = [
  'EXPERIMENT_PROJECTION_GROUP_ID',
  'NOTIFICATION_DISPATCH_GROUP_ID',
  'DECISION_LOGS_GROUP_ID',
  'EVENTS_NORMALIZER_GROUP_ID',
  'EVENTS_ATTRIBUTION_GROUP_ID',
  'CONTROL_EVENTS_GROUP_ID',
] as const;

export function isolateKafkaConsumerGroupsForTests(prefix: string): void {
  const suffix = randomUUID().slice(0, 8);

  process.env.KAFKA_CLIENT_ID = `${prefix}-${suffix}`;
  for (const key of KAFKA_GROUP_ENV_KEYS) {
    process.env[key] = `${prefix}-${key.toLowerCase()}-${suffix}`;
  }

  resetEnvCacheForTests();
}
