# Ключевые архитектурные решения

## ADR-1: Разделение на микросервисы с gateway

**Status:** Accepted

**Context:** Платформа обслуживает два принципиально разных паттерна нагрузки:
hot path (decide — высокая частота, низкая латентность) и write path
(control — CRUD, ревью, отчёты). Сбой одного не должен ронять другой.
Нужна возможность масштабировать decide независимо от control.

**Decision:** 5 сервисов (control-api, decide-api, ingest-api, control-workers,
ingest-workers) за единым NGINX gateway. Каждый сервис — отдельный NestJS
application с собственным `main.ts`.

**Alternatives considered:**

- Монолит с внутренними модулями — проще, но нет изоляции сбоев и независимого масштабирования.
- Отдельные репозитории на сервис — слишком дорого для текущего масштаба команды.

**Consequences:**

- (+) Изоляция: сбой ingest не ломает decide.
- (+) Независимое масштабирование hot path.
- (+) Контракты между сервисами формализованы в `src/contracts/`.
- (−) Больше инфраструктурной сложности (gateway, healthchecks, inter-service contracts).
- (−) Сложнее локальная разработка — 5 процессов.
- Риск снижается: контрактные типы в `src/contracts/`, архитектурный тест
  `test/architecture/microservice-boundaries.spec.ts`.

---

## ADR-2: Decide fail-closed при неготовом снапшоте

**Status:** Accepted

**Context:** При старте decide-api runtime-снапшот ещё не загружен из Redis.
Если в этот момент отдавать решения — они будут основаны на пустом состоянии,
что приведёт к неконтролируемым default-ответам без аудита.

**Decision:** Decide возвращает `SNAPSHOT_NOT_READY` reason и default value
пока `RuntimeSnapshotProvider.isReady()` не вернёт `true`.
Readiness endpoint (`/ready`) включает проверку snapshot readiness.

**Alternatives considered:**

- Fail-open (отдавать default без специального reason) — теряется наблюдаемость проблемы.
- Блокирующая загрузка (ждать snapshot в `onModuleInit`) — увеличивает время старта,
  потенциально блокирует pod readiness.

**Consequences:**

- (+) Не выдаём решения на основе пустого/устаревшего состояния.
- (+) Проблема видна в метриках и логах по reason.
- (−) Кратковременно все получают default при старте/рестарте.
- Снижение риска: timeout fallback в `RedisSnapshotConsumer`
  (`RUNTIME_SNAPSHOT_REDIS_STARTUP_TIMEOUT_MS`) — если Redis недоступен,
  через таймаут помечаем ready и работаем на пустом снапшоте.

---

## ADR-3: Event pipeline через Kafka

**Status:** Accepted

**Context:** Продукт генерирует события (exposure, clicks, conversions), которые
должны быть обработаны (dedup, attribution) и записаны в аналитическое хранилище.
Нужен устойчивый буфер между приёмом и обработкой, возможность replay,
и высокая пропускная способность записи.

**Decision:** 6 Kafka-топиков: `control.domain-events`, `decision.logs`,
`events.raw`, `events.normalized`, `events.attributed`, `metric.observations`.
Ingest-workers обрабатывает последовательно: raw → dedup → normalized → attribution
→ attributed + observations.

**Alternatives considered:**

- Прямая запись в ClickHouse из ingest-api — теряем буфер, retry, replay.
- RabbitMQ — менее подходит для высокопропускного fan-in в ClickHouse.
- 2 топика вместо 4 (объединить dedup+attribution) — сложнее отлаживать и replay.

**Consequences:**

- (+) Устойчивый буфер, replay при сбоях.
- (+) Каждый этап идемпотентен и может быть replay'd.
- (+) ClickHouse Kafka Engine может читать напрямую.
- (−) Eventual consistency — отчёты обновляются с задержкой (секунды).
- (−) 6 топиков — больше операционной сложности.

---

## ADR-4: Метрики из предагрегированных rollups

**Status:** Accepted

**Context:** Отчёты и guardrails должны читать метрики по экспериментам.
Прямое сканирование raw events при каждом запросе даёт непредсказуемую латентность
при росте данных.

**Decision:** Materialized View `metric_rollups_mv` (AggregatingMergeTree)
агрегирует `metric_obs` по минутам. Отчёты и guardrails читают из rollups,
а не из raw events.

**Alternatives considered:**

- Читать raw events с фильтрами — нестабильная латентность при росте.
- Внешний ETL (dbt, Airflow) — избыточно для текущего масштаба.

**Consequences:**

- (+) Стабильная задержка чтения независимо от объёма данных.
- (+) count, sum, quantiles(0.5, 0.9, 0.95, 0.99) доступны из коробки.
- (−) Дополнительная сложность ingestion pipeline.
- (−) Данные доступны только после записи в rollup (eventual consistency).

---

## ADR-5: Participation state в Redis (best-effort)

**Status:** Accepted

**Context:** Платформа должна ограничивать частоту участия пользователя
в экспериментах (max concurrent, cooldown). Проверка происходит на hot path
(decide), поэтому должна быть быстрой.

**Decision:** Лимиты участия и cooldown хранятся в Redis
(`RedisParticipationLimiter`). Обновление неблокирующее —
при сбое Redis decide продолжает работу без enforcement лимитов.

**Alternatives considered:**

- PostgreSQL — слишком медленно для hot path.
- In-memory — не шарится между инстансами decide-api.
- Строгая блокировка (Redis transaction) — увеличивает латентность.

**Consequences:**

- (+) Минимальная задержка decide (Redis RTT).
- (+) Шарится между всеми инстансами decide-api.
- (−) При сбое Redis — пользователь может попасть в эксперимент сверх лимита.
- (−) Best-effort: не даёт 100% гарантию ограничения.

---

## ADR-6: Guardrail ROLLBACK = завершение эксперимента

**Status:** Accepted

**Context:** При срабатывании guardrail с действием ROLLBACK нужно определить,
что происходит с экспериментом: пауза, возврат к control, полное завершение?

**Decision:** Действие `ROLLBACK` завершает эксперимент с outcome `ROLLBACK`.
После завершения runtime возвращает default flag value для всех пользователей.

**Alternatives considered:**

- Промежуточное состояние «rollback to control but still running» — сложнее
  state machine, неочевидная семантика для аналитика.
- Пауза + ручное решение — медленнее реакция на деградацию.

**Consequences:**

- (+) Простота: нет промежуточного состояния.
- (+) Немедленное прекращение деградации.
- (−) Возвращается default, а не explicit control variant value. Допустимо,
  т.к. control обычно совпадает с default.
- (−) Нельзя «возобновить» rollback'd эксперимент — нужно создавать новый.

---

## ADR-7: Experiment как Event-Sourced Aggregate

**Status:** Accepted

**Context:** Эксперимент проходит сложный жизненный цикл (8 статусов,
множество переходов), требуется полная история изменений для аудита и ревью.

**Decision:** Experiment хранится через event store pattern (append-only domain
events в PostgreSQL). Read model строится через проекции.

**Alternatives considered:**

- CRUD с версионированием (version column) — теряем историю промежуточных состояний.
- Event sourcing с отдельным event store (EventStoreDB) — избыточно, ещё одна
  инфраструктурная зависимость.

**Consequences:**

- (+) Полная история всех изменений из коробки.
- (+) Аудит, версионирование, replay.
- (+) Domain events = source of truth для outbox → Kafka.
- (−) Сложнее queries — нужны read projections.
- (−) Rehydration aggregate при каждой команде.

---

## ADR-8: Decision ID = подписанный JWT (HMAC-SHA256)

**Status:** Accepted

**Context:** При ingest событий нужно верифицировать, что decisionId валиден
и привязан к конкретному experiment/variant/subject. Обращение к БД на hot path
ingest — дорого.

**Decision:** Decision token — JWT (HMAC-SHA256, `APP_SECRET`) с payload:
`e` (experimentId), `v` (variantId), `u` (subjectId), `iat`, `exp`.
Ingest-api верифицирует подпись без обращения к БД.

**Alternatives considered:**

- UUID + lookup в Redis/PostgreSQL — дополнительная зависимость на hot path.
- Unsigned token — нет гарантии целостности, можно подделать.

**Consequences:**

- (+) Stateless верификация в ingest-api.
- (+) Tamper-proof: нельзя подменить experimentId/variantId.
- (−) Токен длиннее UUID (~150 chars vs 36 chars).
- (−) При смене APP_SECRET все ранее выданные токены невалидны.
- (−) TTL токена ограничивает окно приёма событий.

---

## ADR-9: Redis Hash + Stream для runtime-снапшотов

**Status:** Accepted

**Context:** Decide-api и ingest-api должны иметь актуальное состояние
флагов/экспериментов и каталога event types. Нужен механизм доставки
обновлений с минимальной задержкой.

**Decision:** Control-workers записывает снапшоты в Redis Hash
(`runtime:snapshots`, `event-type:catalog`) для полного состояния и Redis Stream
(`runtime:snapshots:stream`, `event-type:catalog:stream`) для инкрементальных
обновлений. Consumers читают hash при старте (HGETALL) и подписываются
на stream (XREAD BLOCK).

**Alternatives considered:**

- Kafka compacted topic — decide-api должен быть Kafka consumer,
  сложнее масштабировать stateless инстансы.
- Polling PostgreSQL — высокая нагрузка на БД, задержка.
- Redis Pub/Sub — нет persistence, пропуск при рестарте.

**Consequences:**

- (+) Мгновенное чтение полного состояния при старте (HGETALL).
- (+) Real-time обновления без polling (XREAD BLOCK).
- (+) Decide-api не зависит от Kafka consumer group.
- (−) Redis — SPOF для доставки снапшотов.
- (−) При падении Redis decide-api работает на последнем in-memory снапшоте.

---

## ADR-10: Sequential 4-topic ingest pipeline

**Status:** Accepted

**Context:** Входящие события должны пройти два этапа обработки:
дедупликацию (по eventId) и атрибуцию (привязка к exposure по decisionId).
Этапы имеют разные зависимости и failure modes.

**Decision:** Последовательный pipeline из 4 Kafka-топиков:
`events.raw` → DeduplicationConsumer → `events.normalized` →
AttributionConsumer → `events.attributed` + `metric.observations`.

**Alternatives considered:**

- Один consumer с двумя этапами — сложнее retry и отладка.
- Параллельные consumers — dedup должен предшествовать attribution.
- 2 топика (raw → attributed) — нельзя replay только один этап.

**Consequences:**

- (+) Каждый этап изолирован и идемпотентен.
- (+) Можно replay любой этап независимо.
- (+) Чёткое разделение ответственности: dedup = Redis SET NX,
  attribution = Redis exposure/pending.
- (−) 2 дополнительных Kafka hop'а = дополнительная задержка.
- (−) 4 топика вместо 2 — больше операционной сложности.

---

## ADR-11: ClickHouse Kafka Engine для ingestion

**Status:** Accepted

**Context:** Обработанные события и decision logs должны попадать
в ClickHouse для аналитики. Нужен надёжный fan-in без отдельного writer-сервиса.

**Decision:** ClickHouse сам потребляет из 3 Kafka-топиков
(`decision.logs`, `events.attributed`, `metric.observations`)
через Kafka Engine tables + Materialized Views.

**Alternatives considered:**

- Отдельный writer-сервис → ClickHouse HTTP insert — ещё один сервис для поддержки.
- ClickHouse Kafka Engine + прямая вставка (гибрид) — сложнее consistency.

**Consequences:**

- (+) Zero-code fan-in: ClickHouse управляет offset'ами.
- (+) Не нужен отдельный writer-сервис.
- (+) MV трансформации выполняются внутри ClickHouse.
- (−) Менее гибкий error handling: `kafka_skip_broken_messages = 1000`.
- (−) При schema mismatch сообщения пропускаются молча.
- (−) Сложнее мониторинг Kafka consumer lag из ClickHouse.

---

## ADR-12: Outbox pattern для domain events

**Status:** Accepted

**Context:** Domain events (изменения экспериментов, флагов, guardrail triggers)
должны надёжно попадать в Kafka для projections и notifications.
Прямая публикация из use-case не гарантирует consistency с PostgreSQL.

**Decision:** Domain events сохраняются в `OutboxMessage` таблицу
в той же PostgreSQL-транзакции, что и агрегат. `OutboxRelayService`
(`@Cron(EVERY_SECOND)`) relay'ит в Kafka `control.domain-events`.

**Alternatives considered:**

- Прямая публикация в Kafka из use-case — при сбое Kafka данные
  сохранены в БД, но event потерян.
- CDC (Debezium) — дополнительная инфраструктура.
- Transactional outbox с change data capture — избыточно для текущего масштаба.

**Consequences:**

- (+) At-least-once delivery гарантирован.
- (+) Если Kafka недоступен — события не теряются (копятся в outbox).
- (+) Единая транзакция aggregate + outbox.
- (−) Задержка доставки до 1 секунды (cron interval).
- (−) Outbox table растёт; cleanup `@Cron(EVERY_HOUR)`, retention 7 дней.
- (−) Concurrency: 10 workers в relay, но single-process execution.

---

## ADR-13: Distributed lock для guardrail check

**Status:** Accepted

**Context:** Guardrail check запускается `@Cron(EVERY_MINUTE)` в control-api.
При нескольких инстансах control-api — параллельный запуск приведёт к дублированию
actions (двойной pause/rollback одного эксперимента).

**Decision:** `GuardrailCheckService` использует Redis distributed lock
(`SET NX`, TTL 58s) через `DistributedLockService`. Только один инстанс
выполняет проверку одновременно.

**Alternatives considered:**

- PostgreSQL advisory lock — медленнее, блокирует connection.
- Отдельный singleton-сервис для guardrails — ещё один сервис.
- Idempotent actions (повторный pause = no-op) — не решает проблему
  конкурентного чтения метрик и race condition.

**Consequences:**

- (+) Простая реализация: один Redis key.
- (+) Автоматический release через TTL.
- (−) Single-instance bottleneck: все guardrails проверяются одним процессом.
- (−) При потере lock — пропуск одного цикла (максимум 1 минута).
- (−) Round-robin: `nextStartOffset` обеспечивает fairness при timeout.
