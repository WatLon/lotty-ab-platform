# Runbook: запуск и проверка

## 1. Предусловия

### Для запуска стека (обязательно)

| Зависимость                | Версия |
| -------------------------- | ------ |
| Docker + Docker Compose v2 | 24+    |

### Для запуска тестов и lint (опционально)

| Зависимость | Версия |
| ----------- | ------ |
| Bun         | 1.3+   |

### Свободные host-порты

| Порт | Сервис                                       |
| ---- | -------------------------------------------- |
| 80   | Gateway (NGINX)                              |

## 2. Переменные окружения

Все переменные имеют значения по умолчанию в `docker-compose.yml`.
Стек поднимается без `.env` файла.

Ключевые дефолты (для справки):

| Переменная                 | Значение по умолчанию                        |
| -------------------------- | -------------------------------------------- |
| `APP_SECRET`               | `dev-insecure-secret`                        |
| `BOOTSTRAP_ADMIN_EMAIL`    | `admin@example.com`                          |
| `BOOTSTRAP_ADMIN_PASSWORD` | `SecurePass123`                              |
| `DATABASE_URL`             | `postgresql://postgres:postgres@postgres:5432/app` |
| `POSTGRES_DB`              | `app`                                        |

## 3. Запуск

```bash
docker compose up -d --build
```

Порядок запуска (управляется `depends_on` + `condition`):

1. PostgreSQL, Redis, Kafka, ClickHouse — infra
2. `kafka-init` (create topics), `db-bootstrap` (Prisma schema push), `clickhouse-bootstrap` (DDL migrations)
3. control-api, decide-api, ingest-api, control-workers, ingest-workers
4. gateway (nginx) — последний, ждёт healthy от всех API

## 4. Проверка готовности

```bash
# Дождаться healthy-статуса всех сервисов (обычно 30-60 с)
docker compose ps
# Ожидаемо: gateway, control-api, decide-api, ingest-api,
#           control-workers, ingest-workers — все "healthy"
#           postgres, redis, kafka, clickhouse — "healthy"
#           db-bootstrap, clickhouse-bootstrap, kafka-init — "exited (0)"

# Проверить liveness gateway
curl -f http://127.0.0.1/health
# Ожидаемо: {"status":"ok"}

# Проверить readiness control-api (через gateway)
curl -f http://127.0.0.1/ready
# Ожидаемо: HTTP 200 с JSON body
# Если HTTP 503 — подождать 10-20 с, повторить

# SLA: /ready должен вернуть 200 не позднее 180 с после `docker compose up`
```

## 5. Запуск с observability (опционально)

```bash
docker compose --profile observability up -d --build
```

Дополнительные сервисы: Prometheus, Grafana (через gateway: http://127.0.0.1/grafana/, admin/admin), Loki, Tempo, Alloy.

## 6. Запуск тестов (требует Bun 1.3+)

```bash
# Unit + architecture тесты (не требуют запущенный стек)
bun run test

# E2E тесты (требуют запущенный стек)
bun run test:e2e

# Integration тесты (требуют запущенный стек)
bun run test:integration

# Coverage
bun run test:cov -- --coverage.reporter=lcov --reporter=dot

# Lint + format
bun run lint
bun run format
```

## 7. Остановка

```bash
# Остановить без удаления данных
docker compose down

# Остановить с удалением volumes (чистый старт)
docker compose down -v
```

## 8. Troubleshooting

| Симптом                            | Причина                         | Решение                                                                 |
| ---------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `/ready` → 503 дольше 60 с         | Kafka/ClickHouse ещё стартует   | `docker compose logs kafka`, подождать                                  |
| decide возвращает default для всех | Снапшот не доехал               | `docker compose logs control-workers`, проверить Redis                  |
| ingest отклоняет все события       | Каталог event types не загружен | `docker compose logs ingest-api`, проверить `event-type:catalog` в Redis |
| Guardrail не срабатывает           | Данные ещё не в ClickHouse      | Подождать 1-2 минуты (Kafka Engine + cron interval)                     |
