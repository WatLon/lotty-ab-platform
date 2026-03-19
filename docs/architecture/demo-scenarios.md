# Пакет демо-сценариев

Все команды через gateway `http://127.0.0.1` (порт 80).
Стек поднят и проверен по runbook (все сервисы healthy, `/ready` → 200).

```bash
BASE=http://127.0.0.1
```

> **Примечание о eventual consistency.**
> После создания/изменения флагов, экспериментов и event types требуется 1-3 секунды
> для пропагации через pipeline:
> PostgreSQL → Outbox (@1s) → Kafka → Control Workers → Redis HSET+XADD → API (XREAD).
> В сценариях расставлены `sleep` для надёжного воспроизведения.

---

## S1. Сквозной happy-path (B1-5)

Цель: `decide → ingest event → report`.

### Шаг 1. Логин

```bash
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"SecurePass123"}' \
  | jq -r '.accessToken')
echo "TOKEN=$TOKEN"
```

Ожидаемо: JWT-токен в `accessToken`.

### Шаг 2. Создать event types

```bash
curl -s -X POST $BASE/event-types \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "exposure",
    "name": "Exposure",
    "description": "Факт показа варианта",
    "schema": {},
    "requiresExposure": false
  }' | jq .

curl -s -X POST $BASE/event-types \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "button.clicked",
    "name": "Button Clicked",
    "description": "Клик по кнопке",
    "schema": {},
    "requiresExposure": true
  }' | jq .

# Дождаться пропагации каталога event types в ingest-api через Redis
sleep 3
```

### Шаг 3. Создать metric

```bash
METRIC_ID=$(curl -s -X POST $BASE/metric-definitions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "click_rate",
    "name": "Click Rate",
    "formula": {
      "type": "RATIO",
      "numeratorEventTypeKey": "button.clicked",
      "denominatorEventTypeKey": "exposure"
    }
  }' | jq -r '.id')
echo "METRIC_ID=$METRIC_ID"
```

### Шаг 4. Создать flag

```bash
FLAG_ID=$(curl -s -X POST $BASE/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "button_color",
    "valueType": "STRING",
    "defaultValue": "green"
  }' | jq -r '.id')
echo "FLAG_ID=$FLAG_ID"
```

### Шаг 5. Создать experiment

```bash
EXP_ID=$(curl -s -X POST $BASE/experiments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"Button Color Test\",
    \"flagId\": \"$FLAG_ID\",
    \"audiencePercent\": 100,
    \"variants\": [
      {\"name\": \"Control\", \"value\": \"green\", \"weight\": 50, \"isControl\": true},
      {\"name\": \"Treatment\", \"value\": \"red\", \"weight\": 50, \"isControl\": false}
    ],
    \"metricIds\": [\"$METRIC_ID\"],
    \"primaryMetricId\": \"$METRIC_ID\"
  }" | jq -r '.id')
echo "EXP_ID=$EXP_ID"
```

### Шаг 6. Submit → approve → start

```bash
# Submit for review
curl -s -X POST $BASE/experiments/$EXP_ID/submit \
  -H "Authorization: Bearer $TOKEN" | jq .

# Approve (admin = fallback approver)
curl -s -X POST $BASE/experiments/$EXP_ID/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

# Start
curl -s -X POST $BASE/experiments/$EXP_ID/start \
  -H "Authorization: Bearer $TOKEN" | jq .

# Дождаться пропагации снапшота:
# Outbox → Kafka → Control Workers → Redis → Decide API
sleep 3
```

### Шаг 7. Decide

```bash
DECIDE_RESP=$(curl -s -X POST $BASE/decide \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"user-42","flagKeys":["button_color"]}')
echo "$DECIDE_RESP" | jq .

DECISION_ID=$(echo "$DECIDE_RESP" | jq -r '.decisions[0].decisionId')
VALUE=$(echo "$DECIDE_RESP" | jq -r '.decisions[0].value')
echo "DECISION_ID=$DECISION_ID  VALUE=$VALUE"
```

Ожидаемо: `value` = `"green"` или `"red"`, `reason` = `EXPERIMENT_ASSIGNED`.

### Шаг 8. Ingest events

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -s -X POST $BASE/events/ingest \
  -H 'Content-Type: application/json' \
  -d "{
    \"events\": [
      {
        \"eventId\": \"evt-exp-001\",
        \"eventTypeKey\": \"exposure\",
        \"decisionId\": \"$DECISION_ID\",
        \"subjectId\": \"user-42\",
        \"timestamp\": \"$NOW\"
      },
      {
        \"eventId\": \"evt-click-001\",
        \"eventTypeKey\": \"button.clicked\",
        \"decisionId\": \"$DECISION_ID\",
        \"subjectId\": \"user-42\",
        \"payload\": {\"screen\": \"checkout\"},
        \"timestamp\": \"$NOW\"
      }
    ]
  }" | jq .
```

Ожидаемо: `accepted: 2`, `duplicates: 0`, `rejected: 0`.

### Шаг 9. Report

```bash
# Дождаться eventual consistency:
# events.raw → dedup → events.normalized → attribution → events.attributed → ClickHouse Kafka Engine
sleep 8

FROM=$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-10M +%Y-%m-%dT%H:%M:%SZ)
TO=$(date -u -d '+10 minutes' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+10M +%Y-%m-%dT%H:%M:%SZ)

curl -s "$BASE/reports/experiments/$EXP_ID?from=$FROM&to=$TO" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Ожидаемо: JSON-отчёт с метриками по вариантам за указанный период.

**Автотесты:** `test/integration/decide-ingest.integration.spec.ts`, `test/e2e/reports-outcomes.e2e.spec.ts`

---

## S2. Default / targeting / determinism / weights (B2-1..B2-5)

### B2-1: Без эксперимента → default

```bash
curl -s -X POST $BASE/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"no_exp_flag","valueType":"STRING","defaultValue":"fallback"}' | jq .

sleep 3  # пропагация снапшота

curl -s -X POST $BASE/decide \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"user-99","flagKeys":["no_exp_flag"]}' | jq .
```

Ожидаемо: `value` = `"fallback"`, `experimentId` = `null`.

### B2-2: Targeting не совпал → default

```bash
TARGET_FLAG_ID=$(curl -s -X POST $BASE/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"targeted_flag","valueType":"STRING","defaultValue":"fallback-target"}' | jq -r '.id')

TARGET_EXP_ID=$(curl -s -X POST $BASE/experiments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"Targeting Country Test\",
    \"flagId\": \"$TARGET_FLAG_ID\",
    \"audiencePercent\": 100,
    \"targetingRule\": {\"attribute\":\"country\",\"op\":\"eq\",\"value\":\"KZ\"},
    \"variants\": [
      {\"name\":\"Control\",\"value\":\"A\",\"weight\":50,\"isControl\":true},
      {\"name\":\"Treatment\",\"value\":\"B\",\"weight\":50,\"isControl\":false}
    ],
    \"metricIds\": [\"$METRIC_ID\"],
    \"primaryMetricId\": \"$METRIC_ID\"
  }" | jq -r '.id')

curl -s -X POST $BASE/experiments/$TARGET_EXP_ID/submit \
  -H "Authorization: Bearer $TOKEN" | jq .
curl -s -X POST $BASE/experiments/$TARGET_EXP_ID/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
curl -s -X POST $BASE/experiments/$TARGET_EXP_ID/start \
  -H "Authorization: Bearer $TOKEN" | jq .

sleep 3  # пропагация снапшота

# Вызвать decide с country=US (таргетинг требует KZ)
curl -s -X POST $BASE/decide \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"user-99","attributes":{"country":"US"},"flagKeys":["targeted_flag"]}' | jq .
```

Ожидаемо: `value` = `"fallback-target"`, `reason` содержит `TARGETING_NOT_MATCHED`.

### B2-4: Детерминизм

Повторить тот же decide 5 раз подряд — результат идентичен:

```bash
for i in 1 2 3 4 5; do
  curl -s -X POST $BASE/decide \
    -H 'Content-Type: application/json' \
    -d '{"subjectId":"user-42","flagKeys":["button_color"]}' | jq -r '.decisions[0].value'
done
```

Ожидаемо: одно и то же значение 5 раз.

### B2-5: Веса

Вызвать decide для 100 разных `subjectId`, подсчитать распределение:

```bash
for i in $(seq 1 100); do
  curl -s -X POST $BASE/decide \
    -H 'Content-Type: application/json' \
    -d "{\"subjectId\":\"weight-test-$i\",\"flagKeys\":[\"button_color\"]}" | jq -r '.decisions[0].value'
done | sort | uniq -c
```

Ожидаемо: ~50/50 ±15%.

**Автотесты:** `test/e2e/flags-experiments-runtime.e2e.spec.ts`, `test/unit/apps/decide-api/domain/decision/bucket-calculator.spec.ts`

---

## S3. Lifecycle и review (B3-1..B3-5)

| Переход                    | Endpoint                                                |
| -------------------------- | ------------------------------------------------------- |
| draft → in_review          | `POST /experiments/:id/submit`                          |
| in_review → approved       | `POST /experiments/:id/approve` (при достижении порога) |
| in_review → draft          | `POST /experiments/:id/request-changes`                 |
| in_review → rejected       | `POST /experiments/:id/reject`                          |
| approved → running         | `POST /experiments/:id/start`                           |
| running → paused           | `POST /experiments/:id/pause`                           |
| paused → running           | `POST /experiments/:id/resume`                          |
| running/paused → completed | `POST /experiments/:id/complete`                        |
| completed → archived       | `POST /experiments/:id/archive`                         |
| История ревью              | `GET /experiments/:id/reviews`                          |

Проверки:

- Старт без одобрений → ошибка 4xx
- running → draft → ошибка 4xx
- VIEWER вызывает approve → 403

**Автотесты:** `test/e2e/access-review.e2e.spec.ts`, `test/e2e/criteria-hardening.e2e.spec.ts`

---

## S4. Валидация событий, dedup, атрибуция (B4-1..B4-5)

### B4-1/B4-2: Невалидное событие

```bash
curl -s -X POST $BASE/events/ingest \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"eventId":"x-1","eventTypeKey":"unknown.type","decisionId":"aaaaaaaaaa.bbbbbbbbbb.cccccccccc","subjectId":"u1","timestamp":"2025-01-01T00:00:00Z"}]}' | jq .
```

Ожидаемо: `rejected: 1`, `errors` с описанием причины.

### B4-3: Дубликат

```bash
curl -s -X POST $BASE/events/ingest \
  -H 'Content-Type: application/json' \
  -d "{\"events\":[
    {\"eventId\":\"evt-dup\",\"eventTypeKey\":\"exposure\",\"decisionId\":\"$DECISION_ID\",\"subjectId\":\"user-42\",\"timestamp\":\"$NOW\"},
    {\"eventId\":\"evt-dup\",\"eventTypeKey\":\"exposure\",\"decisionId\":\"$DECISION_ID\",\"subjectId\":\"user-42\",\"timestamp\":\"$NOW\"}
  ]}" | jq .
```

Ожидаемо: `duplicates: 1`.

### B4-5: Конверсия без exposure

Отправить конверсию с `decisionId`, для которого нет exposure — не учитывается в отчёте (помещается в `attr:pending:{decisionId}` в Redis, TTL 7 дней).

**Автотесты:** `test/e2e/events-ingest.e2e.spec.ts`, `test/e2e/events-contract.e2e.spec.ts`, `test/e2e/events-attribution-ordering.e2e.spec.ts`

---

## S5. Guardrails (B5-1..B5-6)

```bash
curl -s -X POST $BASE/experiments/$EXP_ID/guardrails \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"metricId\": \"$METRIC_ID\",
    \"threshold\": 0.5,
    \"operator\": \"GT\",
    \"windowMinutes\": 10,
    \"action\": \"PAUSE\"
  }" | jq .
```

Срабатывание: накидать события выше порога → дождаться cron-цикла (до 1 мин) → эксперимент → PAUSED + trigger audit.

Проверка истории срабатываний:

```bash
curl -s "$BASE/experiments/$EXP_ID/guardrail-triggers?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Ожидаемо: `data[]` с trigger snapshot (`id`, `guardrailId`, `metricValue`, `threshold`, `actionTaken`, `triggeredAt`), сортировка по `triggeredAt desc`.

**Автотесты:** `test/e2e/guardrails.e2e.spec.ts`

---

## S6. Отчётность и исход (B6-1..B6-5)

```bash
# Report
curl -s "$BASE/reports/experiments/$EXP_ID?from=2025-01-01T00:00:00Z&to=2026-12-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Получить варианты
VARIANTS=$(curl -s "$BASE/experiments/$EXP_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.variants')
echo "$VARIANTS"

WINNER_ID=$(echo "$VARIANTS" | jq -r '.[1].id')

# Завершить с исходом
curl -s -X POST $BASE/experiments/$EXP_ID/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"outcomeType\": \"ROLLOUT_WINNER\",
    \"winnerVariantId\": \"$WINNER_ID\",
    \"comment\": \"Treatment +15% CTR без деградации\"
  }" | jq .
```

**Автотесты:** `test/e2e/reports-outcomes.e2e.spec.ts`

---

## S7. Observability (B9)

```bash
# Liveness — gateway проксируется к control-api /health
curl -f http://127.0.0.1/health
# Ожидаемо: {"status":"ok"}

# Readiness — проксируется к control-api, проверяет PostgreSQL/Redis/Kafka/ClickHouse
curl -f http://127.0.0.1/ready
# Ожидаемо: HTTP 200

# Metrics — Prometheus text format (проксируется к control-api)
curl -s http://127.0.0.1/metrics | head -10
# Ожидаемо: HELP/TYPE строки + counter/gauge значения

# Structured logs — JSON (Pino)
docker compose logs --tail=5 control-api 2>&1 | head -5
# Ожидаемо: JSON с полями event, domain, operation, status

# Примечание: /health и /ready каждого backend-сервиса доступны на порту 3000
# внутри Docker network. Через gateway проксируются control-api endpoints
# и Grafana UI (`/grafana/`, если поднят `--profile observability`).
# Для проверки отдельного сервиса:
docker compose exec decide-api wget -qO- http://127.0.0.1:3000/health
docker compose exec ingest-api wget -qO- http://127.0.0.1:3000/ready
```

---

## S8. Lint / format (B10)

```bash
bun run lint     # 0 errors
bun run format   # biome format
```

---

## S9. Допфичи (FX)

### C11 — Конфликтные домены

Создать 2 эксперимента (разные флаги) с `conflictDomain: "checkout"`, разный `priority`.
Decide → побеждает высший `priority`, проигравший → `reason: EXPERIMENT_CONFLICT`.

**Автотесты:** `test/e2e/flags-experiments-runtime.e2e.spec.ts`

### C7 — Уведомления

```bash
# Создать канал
CHANNEL_ID=$(curl -s -X POST $BASE/notifications/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"test-tg","type":"TELEGRAM","config":{"chatId":"123","botToken":"fake"}}' \
  | jq -r '.id')

# Создать правило
curl -s -X POST $BASE/notifications/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"guardrail-alert\",
    \"event\": \"GuardrailTriggered\",
    \"targets\": [{\"channelId\": \"$CHANNEL_ID\"}],
    \"rateLimitCount\": 5,
    \"rateLimitWindowSec\": 60
  }" | jq .
```

Guardrail trigger → delivery record сохранён в PostgreSQL. Rate limit подавляет повторную отправку.

Pipeline: Guardrail fires → domain event → Outbox → Kafka `control.domain-events` → NotificationConsumer → NotificationDispatcher (rule matching + dedup/rate-limit check) → NotificationRenderer → TelegramSender/SlackSender → delivery record.

**Автотесты:** `test/e2e/notifications-c7.e2e.spec.ts`

### C9 — Learnings Library

```bash
# Создать learning
curl -s -X POST $BASE/learnings \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"experimentId\": \"$EXP_ID\",
    \"title\": \"Button Color Experiment\",
    \"hypothesis\": \"Red button increases CTR\",
    \"primaryMetricKey\": \"click_rate\",
    \"summary\": \"Treatment showed +15% CTR\",
    \"actionTaken\": \"ROLLOUT\",
    \"featureKey\": \"button_color\",
    \"tags\": [\"checkout\",\"ui\"]
  }" | jq .

# Поиск похожих
curl -s "$BASE/learnings/similar?experimentId=$EXP_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Автотесты:** `test/e2e/learnings-c9.e2e.spec.ts`
