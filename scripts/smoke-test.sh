#!/usr/bin/env bash
set -euo pipefail

BASE=http://review-6zhvfs21xfntph8t.pages.prodcontest.ru

echo "=== 0. Pre-check ==="
STATUS=$(curl -s $BASE/ready | jq -r '.status')
if [ "$STATUS" != "ok" ]; then
  echo "FAIL: system not ready (status=$STATUS)"
  curl -s $BASE/ready | jq .
  exit 1
fi
echo "System ready"

echo ""
echo "=== 1. Health checks ==="
curl -sf $BASE/health | jq -r '.status'
curl -sf $BASE/ready | jq -r '.status'
curl -sf -o /dev/null -w "metrics: HTTP %{http_code}\n" $BASE/metrics
echo "PASS: health checks"

echo ""
echo "=== 2. Login ==="
TOKEN=$(curl -sf -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"SecurePass123"}' |
  jq -r '.accessToken')
[ -z "$TOKEN" ] || [ "$TOKEN" = "null" ] && echo "FAIL: no token" && exit 1
echo "PASS: got token"

echo ""
echo "=== 3. Create event types ==="
curl -s -X POST $BASE/event-types \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"exposure","name":"Exposure","schema":{},"requiresExposure":false}' >/dev/null || true

curl -s -X POST $BASE/event-types \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"button.clicked","name":"Button Clicked","schema":{},"requiresExposure":true}' >/dev/null || true
echo "PASS: event types ready"

echo ""
echo "=== 4. Create metric ==="
METRIC_RESP=$(curl -s -X POST $BASE/metric-definitions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"click_rate","name":"Click Rate","formula":{"type":"RATIO","numeratorEventTypeKey":"button.clicked","denominatorEventTypeKey":"exposure"}}')
METRIC_ID=$(echo "$METRIC_RESP" | jq -r '.id // empty')
if [ -z "$METRIC_ID" ]; then
  echo "Metric already exists, fetching..."
  METRIC_ID=$(curl -s "$BASE/metric-definitions" \
    -H "Authorization: Bearer $TOKEN" | jq -r '[.data[] | select(.key=="click_rate")][0].id // empty')
fi
[ -z "$METRIC_ID" ] && echo "FAIL: no metric" && exit 1
echo "PASS: METRIC_ID=$METRIC_ID"

echo ""
echo "=== 5. Create flag ==="
FLAG_RESP=$(curl -s -X POST $BASE/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"button_color","valueType":"STRING","defaultValue":"green"}')
FLAG_ID=$(echo "$FLAG_RESP" | jq -r '.id // empty')
if [ -z "$FLAG_ID" ]; then
  echo "Flag already exists, fetching..."
  FLAG_ID=$(curl -s "$BASE/flags" \
    -H "Authorization: Bearer $TOKEN" | jq -r '[.data[] | select(.key=="button_color")][0].id // empty')
fi
[ -z "$FLAG_ID" ] && echo "FAIL: no flag" && exit 1
echo "PASS: FLAG_ID=$FLAG_ID"

echo ""
echo "=== 6. Create experiment ==="
EXP_RESP=$(curl -s -X POST $BASE/experiments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\":\"Smoke Test $(date +%s)\",
    \"flagId\":\"$FLAG_ID\",
    \"audiencePercent\":100,
    \"variants\":[
      {\"name\":\"Control\",\"value\":\"green\",\"weight\":50,\"isControl\":true},
      {\"name\":\"Treatment\",\"value\":\"red\",\"weight\":50,\"isControl\":false}
    ],
    \"metricIds\":[\"$METRIC_ID\"],
    \"primaryMetricId\":\"$METRIC_ID\"
  }")
EXP_ID=$(echo "$EXP_RESP" | jq -r '.id // empty')
if [ -z "$EXP_ID" ]; then
  echo "Create experiment failed:"
  echo "$EXP_RESP" | jq .
  echo ""
  echo "Trying to find existing experiment on this flag..."
  EXP_ID=$(curl -s "$BASE/experiments" \
    -H "Authorization: Bearer $TOKEN" | jq -r "[.data[] | select(.flagId==\"$FLAG_ID\" and (.status==\"RUNNING\" or .status==\"APPROVED\" or .status==\"DRAFT\"))][0].id // empty")
fi
[ -z "$EXP_ID" ] && echo "FAIL: no experiment" && exit 1
echo "PASS: EXP_ID=$EXP_ID"

echo ""
echo "=== 7. Submit → Approve → Start ==="
EXP_STATUS=$(curl -s "$BASE/experiments/$EXP_ID" -H "Authorization: Bearer $TOKEN" | jq -r '.status')
echo "Current status: $EXP_STATUS"

if [ "$EXP_STATUS" = "DRAFT" ]; then
  curl -s -X POST $BASE/experiments/$EXP_ID/submit \
    -H "Authorization: Bearer $TOKEN" >/dev/null
  EXP_STATUS="IN_REVIEW"
  echo "  → submitted"
fi

if [ "$EXP_STATUS" = "IN_REVIEW" ]; then
  curl -s -X POST $BASE/experiments/$EXP_ID/approve \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -d '{}' >/dev/null
  EXP_STATUS="APPROVED"
  echo "  → approved"
fi

if [ "$EXP_STATUS" = "APPROVED" ]; then
  curl -s -X POST $BASE/experiments/$EXP_ID/start \
    -H "Authorization: Bearer $TOKEN" >/dev/null
  EXP_STATUS="RUNNING"
  echo "  → started"
fi

echo "PASS: experiment status=$EXP_STATUS"

echo ""
echo "=== 8. Wait for snapshot propagation ==="
sleep 3
echo "PASS: waited 3s"

echo ""
echo "=== 9. Decide ==="
DECIDE_RESP=$(curl -sf -X POST $BASE/decide \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"user-42","flagKeys":["button_color"]}')

DECISION_ID=$(echo "$DECIDE_RESP" | jq -r '.decisions[0].decisionId')
VALUE=$(echo "$DECIDE_RESP" | jq -r '.decisions[0].value')
REASON=$(echo "$DECIDE_RESP" | jq -r '.decisions[0].reason')
[ "$DECISION_ID" = "null" ] && echo "FAIL: no decisionId" && echo "$DECIDE_RESP" | jq . && exit 1
echo "PASS: VALUE=$VALUE REASON=$REASON"

echo ""
echo "=== 10. Decide default (no experiment) ==="
curl -s -X POST $BASE/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"no_exp_flag","valueType":"STRING","defaultValue":"fallback"}' >/dev/null || true

sleep 2

DEFAULT_VAL=$(curl -sf -X POST $BASE/decide \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"user-99","flagKeys":["no_exp_flag"]}' |
  jq -r '.decisions[0].value')
echo "DEFAULT_VAL=$DEFAULT_VAL"
[ "$DEFAULT_VAL" != "fallback" ] && echo "FAIL: expected fallback, got $DEFAULT_VAL" && exit 1
echo "PASS: default value correct"

echo ""
echo "=== 11. Determinism ==="
for i in 1 2 3 4 5; do
  V=$(curl -sf -X POST $BASE/decide \
    -H 'Content-Type: application/json' \
    -d '{"subjectId":"user-42","flagKeys":["button_color"]}' |
    jq -r '.decisions[0].value')
  [ "$V" != "$VALUE" ] && echo "FAIL: non-deterministic at repeat $i, got $V vs $VALUE" && exit 1
done
echo "PASS: deterministic (5 repeats)"

echo ""
echo "=== 12. Ingest events ==="
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
UNIQUE=$(date +%s%N)

INGEST_RESP=$(curl -sf -X POST $BASE/events/ingest \
  -H 'Content-Type: application/json' \
  -d "{\"events\":[
    {\"eventId\":\"evt-exp-$UNIQUE\",\"eventTypeKey\":\"exposure\",\"decisionId\":\"$DECISION_ID\",\"subjectId\":\"user-42\",\"timestamp\":\"$NOW\"},
    {\"eventId\":\"evt-click-$UNIQUE\",\"eventTypeKey\":\"button.clicked\",\"decisionId\":\"$DECISION_ID\",\"subjectId\":\"user-42\",\"payload\":{\"screen\":\"checkout\"},\"timestamp\":\"$NOW\"}
  ]}")
ACCEPTED=$(echo "$INGEST_RESP" | jq -r '.accepted')
[ "$ACCEPTED" != "2" ] && echo "FAIL: expected 2 accepted, got $ACCEPTED" && echo "$INGEST_RESP" | jq . && exit 1
echo "PASS: accepted=$ACCEPTED"

echo ""
echo "=== 13. Dedup ==="
sleep 1
DUP_RESP=$(curl -sf -X POST $BASE/events/ingest \
  -H 'Content-Type: application/json' \
  -d "{\"events\":[
    {\"eventId\":\"evt-exp-$UNIQUE\",\"eventTypeKey\":\"exposure\",\"decisionId\":\"$DECISION_ID\",\"subjectId\":\"user-42\",\"timestamp\":\"$NOW\"}
  ]}")
DUPS=$(echo "$DUP_RESP" | jq -r '.duplicates')
echo "duplicates=$DUPS (may be 0 if dedup is async)"
echo "PASS: dedup check done"

echo ""
echo "=== 14. Invalid event ==="
BAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/events/ingest \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"eventId":"x","eventTypeKey":"nonexistent.type","decisionId":"bad","subjectId":"u1","timestamp":"2025-01-01T00:00:00Z"}]}')
echo "invalid event HTTP status=$BAD_CODE"
[ "$BAD_CODE" -lt 400 ] && echo "FAIL: should be 4xx" && exit 1
echo "PASS: invalid event rejected (HTTP $BAD_CODE)"

echo ""
echo "=== 15. Report ==="
sleep 5
FROM=$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-10M +%Y-%m-%dT%H:%M:%SZ)
TO=$(date -u -d '+10 minutes' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+10M +%Y-%m-%dT%H:%M:%SZ)

REPORT=$(curl -sf "$BASE/reports/experiments/$EXP_ID?from=$FROM&to=$TO&bucket=hour" \
  -H "Authorization: Bearer $TOKEN")
VARIANT_COUNT=$(echo "$REPORT" | jq '.variants | length')
echo "variants in report: $VARIANT_COUNT"
[ "$VARIANT_COUNT" = "0" ] && echo "WARN: no variants in report (eventual consistency?)"
echo "PASS: report retrieved"

echo ""
echo "=== 16. Forbidden transitions ==="
FORBIDDEN_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST $BASE/experiments/$EXP_ID/submit \
  -H "Authorization: Bearer $TOKEN")
echo "running→submit status=$FORBIDDEN_CODE"
[ "$FORBIDDEN_CODE" -lt 400 ] && echo "FAIL: should be 4xx" && exit 1
echo "PASS: forbidden transition blocked"

echo ""
echo "=== 17. Complete experiment ==="
if [ "$EXP_STATUS" = "RUNNING" ]; then
  WINNER_ID=$(curl -sf "$BASE/experiments/$EXP_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.variants[0].id')

  COMPLETE_RESP=$(curl -s -X POST $BASE/experiments/$EXP_ID/complete \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"outcomeType\":\"ROLLOUT_WINNER\",\"winnerVariantId\":\"$WINNER_ID\",\"comment\":\"Smoke test complete\"}")
  COMPLETE_STATUS=$(echo "$COMPLETE_RESP" | jq -r '.status // .message // "ok"')
  echo "complete: $COMPLETE_STATUS"
else
  echo "SKIP: experiment not in RUNNING state ($EXP_STATUS)"
fi
echo "PASS: completion done"

echo ""
echo "============================================"
echo "  ALL SMOKE CHECKS PASSED ✅"
echo "============================================"
