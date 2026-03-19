# Карта репозитория

## Точки входа сервисов

| Сервис          | Entry point                        | Порт | Роль                                                                                    |
| --------------- | ---------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| Control API     | `src/apps/control-api/main.ts`     | 3000 | CRUD флагов, экспериментов, метрик, ревью, отчёты, guardrails, notifications, learnings |
| Decide API      | `src/apps/decide-api/main.ts`      | 3000 | Runtime-выдача значений флагов                                                          |
| Ingest API      | `src/apps/ingest-api/main.ts`      | 3000 | Приём событий от продукта                                                               |
| Control Workers | `src/apps/control-workers/main.ts` | 3000 | Kafka consumers: projections → Redis, notifications                                     |
| Ingest Workers  | `src/apps/ingest-workers/main.ts`  | 3000 | Kafka consumers: deduplication, attribution                                             |

## Типовая структура API-сервисов (`control-api`, `decide-api`, `ingest-api`)

```text
src/apps/<service>/
├── application/    — use-cases, commands, queries, порты (interfaces)
├── domain/         — агрегаты, value objects, domain events, ошибки, enums
├── infrastructure/ — адаптеры (Prisma, Redis, Kafka, ClickHouse)
├── presentation/   — контроллеры, DTO, error schemas, фильтры
└── main.ts         — bootstrap
```

## Worker-сервисы

```text
src/apps/control-workers/
├── experiment/
│   ├── control-events.consumer.ts   — consume control.domain-events из Kafka
│   ├── flag.projection.ts           — PostgreSQL → Redis HSET+XADD (runtime:snapshots)
│   └── event-type.projection.ts     — PostgreSQL → Redis HSET+XADD (event-type:catalog)
├── notification/
│   ├── notification.consumer.ts     — consume control.domain-events из Kafka
│   ├── notification.dispatcher.ts   — rule matching, dedup, rate-limit
│   ├── notification.renderer.ts     — template rendering
│   ├── telegram.sender.ts           — Telegram HTTP API
│   └── slack.sender.ts              — Slack HTTP API
└── main.ts

src/apps/ingest-workers/
├── deduplication.consumer.ts   — consume events.raw → Redis SET NX → produce events.normalized
├── attribution.consumer.ts     — consume events.normalized → Redis exposure → produce events.attributed + metric.observations
├── ingest-workers.module.ts
└── main.ts
```

## Shared-код

| Путь                                            | Назначение                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/shared/domain/common/`                     | Базовые классы: AggregateRoot, Entity, ValueObject, Result, Identity, DomainEvent             |
| `src/shared/domain/targeting/`                  | Парсер и evaluator DSL таргетинга (AST, operators, limits)                                    |
| `src/shared/infrastructure/cache/`              | Redis client, distributed lock, `RedisSnapshotConsumer` (base class для snapshot consumption) |
| `src/shared/infrastructure/clickhouse/`         | ClickHouse client, bootstrap queries (DDL + Kafka Engine tables)                              |
| `src/shared/infrastructure/kafka/`              | Kafka service (publish/subscribe), topic constants (6 топиков)                                |
| `src/shared/infrastructure/logging/`            | Pino config, structured logging adapter, HTTP context util                                    |
| `src/shared/infrastructure/persistence/`        | Prisma service, base repository, outbox envelope mapper, optimistic update util               |
| `src/shared/infrastructure/config/`             | Typed config service, env validation (Zod)                                                    |
| `src/shared/infrastructure/runtime-snapshot/`   | Redis key constants (`runtime:snapshots`, `runtime:snapshots:stream`)                         |
| `src/shared/infrastructure/event-type-catalog/` | Redis key constants (`event-type:catalog`, `event-type:catalog:stream`)                         |
| `src/shared/infrastructure/security/`           | HMAC crypto service (decision token signing)                                                  |
| `src/shared/presentation/health/`               | `/health` и `/ready` контроллеры                                                              |
| `src/shared/presentation/metrics/`              | `/metrics` контроллер и Prometheus counters/histograms                                        |
| `src/shared/presentation/common/`               | Декораторы (`@CurrentUser`, `@Roles`, `@Public`), фильтры ошибок, interceptors                |

## Контракты между сервисами

| Файл                                             | Описание                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `src/contracts/control-domain-event-envelope.ts` | Zod-схема domain event envelope для Kafka `control.domain-events` |
| `src/contracts/decision-runtime.ts`              | Types для runtime snapshot (flag + experiment views)              |
| `src/contracts/decision-token.ts`                | JWT payload для decision ID (experimentId, variantId, subjectId)  |
| `src/contracts/event-type-runtime.ts`            | Type для event-type catalog entry                                 |
| `src/contracts/ingest-events.ts`                 | Types для ingest event messages и batches                         |

## Kafka-топики (6 шт)

| Топик                   | Partitions | Producer                               | Consumer                                                           |
| ----------------------- | ---------- | -------------------------------------- | ------------------------------------------------------------------ |
| `control.domain-events` | 6          | control-api (outbox relay)             | control-workers (projections + notifications)                      |
| `decision.logs`         | 24         | decide-api                             | ClickHouse Kafka Engine → `decisions` table                        |
| `events.raw`            | 24         | ingest-api                             | ingest-workers (DeduplicationConsumer)                             |
| `events.normalized`     | 24         | ingest-workers (DeduplicationConsumer) | ingest-workers (AttributionConsumer)                               |
| `events.attributed`     | 24         | ingest-workers (AttributionConsumer)   | ClickHouse Kafka Engine → `events` table                           |
| `metric.observations`   | 24         | ingest-workers (AttributionConsumer)   | ClickHouse Kafka Engine → `metric_obs` table → `metric_rollups_mv` |

## Redis-ключи

| Key pattern                | Тип                          | TTL          | Producer → Consumer                              |
| -------------------------- | ---------------------------- | ------------ | ------------------------------------------------ |
| `runtime:snapshots`        | Hash (field = flag.key)      | —            | control-workers FlagProjection → decide-api      |
| `runtime:snapshots:stream` | Stream (MAXLEN ~1000)        | —            | control-workers FlagProjection → decide-api      |
| `event-type:catalog`        | Hash (field = eventType.key) | —            | control-workers EventTypeProjection → ingest-api |
| `event-type:catalog:stream` | Stream (MAXLEN ~1000)        | —            | control-workers EventTypeProjection → ingest-api |
| `idem:event:{eventId}`     | String (SET NX)              | 7 days       | ingest-workers DeduplicationConsumer             |
| `attr:exposure:{decisionId}`    | String                       | 7 days       | ingest-workers AttributionConsumer               |
| `attr:pending:{decisionId}`     | List                         | 7 days       | ingest-workers AttributionConsumer               |
| `cron:guardrail-check`     | String (SET NX)              | 58s          | control-api GuardrailCheckService                |
| `participation:*`          | varies                       | configurable | decide-api RedisParticipationLimiter             |

## Инфраструктура

| Путь                             | Назначение                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway/nginx.conf`             | NGINX reverse proxy: `/` → control-api, `/decide` → decide-api, `/events/ingest` → ingest-api, `/docs/*` → swagger, `/grafana/*` → Grafana |
| `prisma/schema/`                 | Prisma multi-file schema (base, enums, flags, experiments, events, guardrails, metrics, users-access, notifications, learnings, outbox) |
| `scripts/create-kafka-topics.ts` | KafkaJS topic creation (used in dev; prod uses shell in kafka-init)                                                                     |
| `scripts/migrate-clickhouse.ts`  | ClickHouse DDL migrations (tables + Kafka Engine + MV)                                                                                  |
| `observability/`                 | Prometheus, Grafana (7 dashboards), Loki, Tempo, Alloy configs                                                                          |
| `perf/k6/`                       | k6 нагрузочные тесты (smoke, decide p99 stress)                                                                                         |

## Тесты

| Путь                 | Назначение                                   | Зависимости              |
| -------------------- | -------------------------------------------- | ------------------------ |
| `test/unit/`         | Unit-тесты (зеркалят структуру `src/`)       | Без внешних зависимостей |
| `test/integration/`  | Integration-тесты (decide → ingest pipeline) | Запущенный стек          |
| `test/e2e/`          | End-to-end через HTTP API                    | Запущенный стек          |
| `test/architecture/` | Архитектурные ограничения (границы модулей)  | Без внешних зависимостей |
