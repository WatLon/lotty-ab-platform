# Ограничения и упрощения

## 1. Eventual consistency

Данные из Kafka/ClickHouse доступны в отчётах с задержкой (секунды). Decide-снапшот обновляется через Redis Hash + Stream consumer. Полный путь обновления: PostgreSQL → Outbox (≤1s) → Kafka → Control Workers → Redis → Decide API in-memory — суммарно 1-3 секунды.

## 2. Guardrail ROLLBACK возвращает default, а не control variant

После rollback эксперимент завершается и runtime возвращает flag default value. Если control variant отличается от default — разница не учитывается. В подавляющем большинстве случаев control = default.

## 3. Participation limiter — best-effort

Обновление состояния участия в Redis неблокирующее на hot path decide. При временном сбое Redis пользователь может быть включён в эксперимент сверх лимита.

## 4. ClickHouse TTL — 90 дней

Горячие аналитические данные (events, decisions, metric_obs) хранятся 90 дней. Долгосрочный архив вне scope.

## 5. C11 — реализованы mutual exclusion и priority tiers

Из трёх политик разрешения конфликтов (§11.4) реализованы две: mutual exclusion (§11.4.1) и priority tiers (§11.4.3). Конкурентный выбор по ставке (bidding, §11.4.2) не реализован — в текущих use-cases достаточно приоритетов.

## 6. In-process метрики

`/metrics` — runtime counters из памяти процесса. Долгосрочное хранение через внешний Prometheus (profile `observability`).

## 7. Integration/e2e тесты требуют внешних зависимостей

PostgreSQL, Redis, Kafka, ClickHouse. Запуск через `docker compose`.

## 8. APP_SECRET rotation

При смене `APP_SECRET` все ранее выданные decision tokens (JWT HMAC-SHA256) становятся невалидны. Ingest-api отклонит события с такими `decisionId`. Рекомендация: плановая ротация вне активных экспериментов или grace period с двумя секретами (не реализовано).

## 9. Single Redis — single point of failure

При падении Redis:

- decide-api работает на последнем in-memory снапшоте (stale, но не пустом);
- participation limiter не ограничивает (best-effort);
- deduplication в ingest-workers не работает (возможны дубликаты в ClickHouse, ReplacingMergeTree дедуплицирует при merge);
- event-type каталог в ingest-api не обновляется (stale in-memory).

## 10. Outbox relay latency

Domain events попадают в Kafka с задержкой до 1 секунды (`OutboxRelayService` `@Cron(EVERY_SECOND)`). Плюс задержка Redis stream propagation. Итого от изменения в control-api до обновления снапшота в decide-api — 1-3 секунды.

## 11. decide-api лишняя зависимость от ClickHouse

В `docker-compose.yml` decide-api объявлен с `depends_on: clickhouse`, хотя не использует ClickHouse. Это замедляет startup при cold start. Не влияет на runtime.

## 12. ClickHouse Kafka Engine skip broken messages

`kafka_skip_broken_messages = 1000` — при schema mismatch между Kafka-сообщением и ClickHouse Kafka Engine table, сообщения молча пропускаются. Нет alerting на пропущенные сообщения.

## 13. Guardrail check — single-instance bottleneck

`GuardrailCheckService` запускается каждую минуту и обрабатывает эксперименты последовательно с round-robin offset. Max execution time = 55s. При большом количестве экспериментов (сотни) — не все могут быть проверены за один цикл.
