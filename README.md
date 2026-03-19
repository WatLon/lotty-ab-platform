# LOTTY A/B Platform

Backend-платформа для A/B-экспериментов: feature flags, runtime-выдача вариантов, сбор событий, отчёты, guardrails, уведомления, learnings library.

## Быстрый старт

### Предусловия

| Зависимость                | Версия |
| -------------------------- | ------ |
| Docker + Docker Compose v2 | 24+    |
| Bun (только для тестов)    | 1.3+   |

Свободный host-порт: `80` (все остальные сервисы доступны только внутри Docker network; Grafana — через gateway `/grafana/`).

### Запуск

```bash
docker compose up -d --build
```

### Проверка готовности

```bash
# Ожидаем readiness (SLA ≤ 180 секунд)
time bash -c 'while ! curl -sf http://127.0.0.1/ready > /dev/null 2>&1; do sleep 2; done'
echo "System ready"

# Все сервисы healthy
docker compose ps
```

Ожидаемо: 5 app-сервисов + gateway в статусе `healthy`.

### Остановка

```bash
docker compose down      # сохранить volumes
docker compose down -v   # удалить volumes
```

---

## Архитектура

5 микросервисов за NGINX gateway:

```
Gateway (:80)
├── Control API    — CRUD: флаги, эксперименты, метрики, ревью, отчёты, learnings
│                    + outbox relay (@Cron) + guardrail checks (@Cron)
├── Decide API     — Runtime: выдача значений флагов (POST /decide)
├── Ingest API     — Приём событий от продукта (POST /events/ingest)
├── Control Workers — Kafka consumer: projections → Redis, notifications → Telegram/Slack
└── Ingest Workers  — Kafka pipeline: dedup → attribution → metric observations
```

Хранилища: **PostgreSQL** (OLTP), **ClickHouse** (OLAP), **Redis** (snapshots, state), **Kafka** (6 topics).

Подробнее: [Карта репозитория](docs/architecture/repo-map.md) · [ADR](docs/architecture/architecture-decisions.md) · [C4 диаграммы](docs/architecture/c4/)

---

## Bootstrap Admin

При первом старте автоматически создаётся admin-пользователь:

```
Email:    admin@example.com
Password: SecurePass123
```

---

## API Documentation (Scalar UI)

| Сервис      | URL                          |
| ----------- | ---------------------------- |
| Control API | http://127.0.0.1/docs        |
| Decide API  | http://127.0.0.1/docs/decide |
| Ingest API  | http://127.0.0.1/docs/ingest |

---

## Демо-сценарии

Пошаговые curl-сценарии для проверки всех критериев B1–B10 и допфич C7/C9/C11:

📄 **[docs/architecture/demo-scenarios.md](docs/architecture/demo-scenarios.md)**

### Быстрая проверка сквозного happy-path

```bash
BASE=http://127.0.0.1

# 1. Логин
TOKEN=$(curl -sf -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"SecurePass123"}' \
  | jq -r '.accessToken')

# 2. Создать флаг
FLAG_ID=$(curl -sf -X POST $BASE/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"quick_test","valueType":"STRING","defaultValue":"off"}' \
  | jq -r '.id')

# 3. Decide без эксперимента → default
curl -sf -X POST $BASE/decide \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"user-1","flagKeys":["quick_test"]}' | jq .
# Ожидаемо: value = "off", reason != "EXPERIMENT_ASSIGNED"
```

Полный сквозной сценарий (decide → ingest → report) — в [demo-scenarios.md §S1](docs/architecture/demo-scenarios.md).

---

## Observability

```bash
# Liveness (gateway)
curl -f http://127.0.0.1/health
# → {"status":"ok"}

# Readiness (control-api: PostgreSQL + Redis + ClickHouse + Kafka)
curl -f http://127.0.0.1/ready

# Prometheus metrics (control-api)
curl -s http://127.0.0.1/metrics | head -10

# Structured JSON logs
docker compose logs --tail=5 control-api
```

### Grafana (опционально)

```bash
docker compose --profile observability up -d --build
# Grafana (через gateway): http://127.0.0.1/grafana/ (admin/admin)
# 7 dashboards: platform overview, HTTP runtime, decide/ingest, guardrails, logs, traces, outcomes
```

---

## Тесты

| Команда                    | Что проверяет                 | Зависимости                             |
| -------------------------- | ----------------------------- | --------------------------------------- |
| `bun run test`             | Unit + architecture tests     | Без внешних (только Bun)                |
| `bun run test:e2e`         | End-to-end через HTTP API     | Docker стек (запускается автоматически) |
| `bun run test:integration` | Decide → ingest pipeline      | Docker стек (запускается автоматически) |
| `bun run test:cov`         | Coverage (unit + arch)        | Без внешних                             |
| `bun run lint`             | Biome lint                    | Без внешних                             |
| `bun run lint:arch`        | Архитектурные границы модулей | Без внешних                             |
| `bun run format`           | Biome format                  | Без внешних                             |
| `bun run typecheck:all`    | TSC strict                    | Без внешних                             |

Подробный отчёт: [testing-report.md](docs/architecture/testing-report.md)

---

## Нагрузочное тестирование

```bash
# Smoke test (decide + ingest)
bun run perf:smoke

# Decide p99 stress
bun run perf:decide:p99
```

Требует запущенный стек и установленный [k6](https://grafana.com/docs/k6/).

---

## Документация

| Документ                                                              | Описание                                                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Runbook](docs/architecture/runbook.md)                               | Запуск, проверки, SLA, troubleshooting                                                                                                                              |
| [Demo Scenarios](docs/architecture/demo-scenarios.md)                 | Пошаговые curl-сценарии для всех критериев                                                                                                                          |
| [Compliance Matrix](docs/architecture/compliance-matrix.md)           | Задание → критерий → реализация → тест                                                                                                                              |
| [Architecture Decisions](docs/architecture/architecture-decisions.md) | 13 ADR                                                                                                                                                              |
| [Limitations](docs/architecture/limitations.md)                       | Ограничения и упрощения                                                                                                                                             |
| [Testing Report](docs/architecture/testing-report.md)                 | Тесты, покрытие, команды                                                                                                                                            |
| [Operational Readiness](docs/architecture/operational-readiness.md)   | Health, metrics, logs, performance                                                                                                                                  |
| [Repo Map](docs/architecture/repo-map.md)                             | Карта репозитория, Kafka topics, Redis keys                                                                                                                         |
| C4 Diagrams                                                           | [Context](docs/architecture/c4/context.mmd) · [Container](docs/architecture/c4/container.mmd) · [Component](docs/architecture/c4/component-decide-event-report.mmd) |

---
