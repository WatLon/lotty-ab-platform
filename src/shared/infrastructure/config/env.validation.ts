import * as z from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  PG_POOL_MAX: z.coerce.number().int().min(1).default(5),
  PG_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30000),
  PG_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),

  KAFKA_BROKERS: z.string().min(1).default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().min(1).default('lotty-ab-platform'),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  CLICKHOUSE_HOST: z.string().min(1).default('http://localhost:8123'),
  CLICKHOUSE_USER: z.string().min(1).default('lotty'),
  CLICKHOUSE_PASSWORD: z.string().default('lotty'),
  CLICKHOUSE_DATABASE: z.string().min(1).default('default'),
  CLICKHOUSE_DECISIONS_KAFKA_GROUP: z.string().min(1).default('clickhouse-decisions-sink'),
  CLICKHOUSE_DECISIONS_KAFKA_CONSUMERS: z.coerce.number().int().min(1).default(1),

  APP_SECRET: z.string().min(1),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).default(900),
  DECISION_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).default(604800),
  DECIDE_THROTTLE_DISABLED: z.coerce.boolean().default(false),
  DECIDE_THROTTLE_LIMIT: z.coerce.number().int().min(1).default(200),
  DECIDE_THROTTLE_TTL_MS: z.coerce.number().int().min(1).default(1000),

  BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),

  SUBJECT_PARTICIPATION_MAX_CONCURRENT_EXPERIMENTS: z.coerce.number().int().min(1).default(3),
  SUBJECT_PARTICIPATION_COOLDOWN_AFTER_TOTAL: z.coerce.number().int().min(1).default(10),
  SUBJECT_PARTICIPATION_ROLLING_WINDOW_MS: z.coerce.number().int().min(1).default(86400000),
  SUBJECT_PARTICIPATION_COOLDOWN_PERIOD_MS: z.coerce.number().int().min(1).default(3600000),

  EXPERIMENT_PROJECTION_GROUP_ID: z.string().min(1).default('experiment-projection'),
  NOTIFICATION_DISPATCH_GROUP_ID: z.string().min(1).default('notification-dispatch'),
  DECISION_LOGS_GROUP_ID: z.string().min(1).default('decision-logs-writer'),
  EVENTS_NORMALIZER_GROUP_ID: z.string().min(1).default('events-normalizer'),
  EVENTS_ATTRIBUTION_GROUP_ID: z.string().min(1).default('events-attribution'),
  CONTROL_EVENTS_GROUP_ID: z.string().min(1).default('runtime-compiler-control-events'),
  EVENT_TYPE_CATALOG_REDIS_STARTUP_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
  RUNTIME_SNAPSHOT_REDIS_STARTUP_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),

  PORT: z.coerce.number().int().min(1).default(3000),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
