# Эксплуатационная готовность

## 1. Health / Readiness

### Gateway (Nginx :8080 → host :80)

| Endpoint       | Что проверяет                         | Код       |
| -------------- | ------------------------------------- | --------- |
| `GET /health`  | Проксируется к control-api /health    | 200       |
| `GET /ready`   | Проксируется к control-api `/ready`   | 200 / 503 |
| `GET /metrics` | Проксируется к control-api `/metrics` | 200       |

### Backend-сервисы (каждый на :3000, внутри Docker network)

| Сервис          | `GET /health` | `GET /ready`                                    |
| --------------- | ------------- | ----------------------------------------------- |
| control-api     | Process alive | PostgreSQL + Redis + ClickHouse + Kafka         |
| decide-api      | Process alive | Redis + Kafka + RuntimeSnapshot.isReady()       |
| ingest-api      | Process alive | ClickHouse + Kafka + EventTypeCatalog.isReady() |
| control-workers | Process alive | Зависит от injected @Optional providers         |
| ingest-workers  | Process alive | Зависит от injected @Optional providers         |

Docker healthcheck для всех сервисов использует `wget -qO- http://127.0.0.1:3000/health`.
SLA: `/ready` через gateway возвращает 200 не позднее 180 секунд после `docker compose up`.

При таймауте загрузки снапшота (настраивается через env) decide-api и ingest-api принудительно переходят в ready и начинают выдавать default-значения / принимать события по stale каталогу.

## 2. Метрики

Endpoint: `GET /metrics` (Prometheus text format).

Доступ через gateway → проксируется к control-api.
Для decide-api и ingest-api: `docker compose exec <service> wget -qO- http://localhost:3000/metrics`.

Platform метрики (определены в `MetricsService`):

| Имя                        | Тип       | Описание                                                                    |
| -------------------------- | --------- | --------------------------------------------------------------------------- |
| `http_requests_total`      | Counter   | HTTP-запросы (labels: method, path, status)                                 |
| `lotty_decide_total`       | Counter   | Decide-запросы                                                              |
| `lotty_ingest_total`       | Counter   | Ingested events                                                             |
| `lotty_decide_duration_ms` | Histogram | Latency decide (buckets: 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000 ms) |
| `lotty_active_experiments` | Gauge     | Активные эксперименты (RUNNING + PAUSED)                                    |

Дополнительно: `collectDefaultMetrics()` — стандартные Node.js process metrics (heap, GC, event loop).

## 3. Логи

Формат: JSON (Pino).
Стабильные поля: `event`, `domain`, `operation`, `status`, `statusCode`, `durationMs`, `requestId`.

Проверка:

```bash
docker compose logs --tail=5 control-api 2>&1 | head -5
```

Сбор: Grafana Alloy → Loki (при включённом observability profile).

## 4. Трейсинг

OpenTelemetry → Grafana Tempo (при включённом observability profile).
Env: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://alloy:4318/v1/traces`.

## 5. Нагрузочное тестирование

| Скрипт     | Команда                                                | Что проверяет                           |
| ---------- | ------------------------------------------------------ | --------------------------------------- |
| Smoke      | `BASE_URL=http://localhost:80 bun run perf:smoke`      | Базовая работоспособность decide+ingest |
| Decide p99 | `BASE_URL=http://localhost:80 bun run perf:decide:p99` | Latency decide под нагрузкой            |

Скрипты: `perf/k6/smoke-decide-ingest.js`, `perf/k6/decide-p99-stress.js`.

## 6. Эффективность хранения

### PostgreSQL

- Уникальные индексы: `flags(key)`, `users(email)`, `experiments(flagId+status)`, `event_types(key)`
- Optimistic locking через `version` columns
- Outbox cleanup: `@Cron(EVERY_HOUR)`, retention 7 дней

### ClickHouse

- ReplacingMergeTree: `events` (ORDER BY eventId), `decisions` (ORDER BY id) — дедупликация при merge
- MergeTree: `metric_obs` (ORDER BY experimentId, variantId, metricKey, timestamp)
- AggregatingMergeTree: `metric_rollups_mv` — предагрегированные minute-buckets (count, sum, quantiles)
- PARTITION BY `toYYYYMM(timestamp)` на всех таблицах
- TTL 90 дней на всех данных
- Kafka Engine tables для fan-in ingestion из 3 топиков

### Redis

- TTL на ключах: `idem:event:*` (7 дней), `attr:exposure:*` (7 дней), `attr:pending:*` (7 дней), guardrail lock (58s)
- Redis Streams с MAXLEN ~1000 для снапшотов
- Неблокирующие записи на hot path (participation limiter)

## 7. Grafana Dashboards (observability profile)

Grafana доступна через gateway: `http://127.0.0.1/grafana/` (admin/admin).

| #   | Dashboard                | Файл                             |
| --- | ------------------------ | -------------------------------- |
| 1   | Platform Overview        | `01-platform-overview.json`      |
| 2   | HTTP Runtime             | `02-http-runtime.json`           |
| 3   | Decide & Ingest Product  | `03-decide-ingest-product.json`  |
| 4   | Guardrails               | `04-guardrails.json`             |
| 5   | Logs & Operations        | `05-logs-operations.json`        |
| 6   | Traces & Operations      | `06-traces-operations.json`      |
| 7   | Experiment Outcomes (B6) | `07-experiment-outcomes-b6.json` |
