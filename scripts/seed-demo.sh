#!/usr/bin/env bash
set -euo pipefail

BASE="http://review-6zhvfs21xfntph8t.pages.prodcontest.ru"

# ── helpers ──────────────────────────────────────────────
upsert_user() {
  local email="$1" password="$2" name="$3" role="$4"
  local id
  id=$(curl -sf "$BASE/users" -H "$AUTH" | jq -r ".data[] | select(.email==\"$email\") | .id // empty")
  if [ -n "$id" ]; then
    echo "$id"
    return
  fi
  curl -sf -X POST "$BASE/users" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"name\":\"$name\",\"role\":\"$role\"}" | jq -r '.id'
}

upsert_event_type() {
  local key="$1" name="$2" desc="$3" schema="$4" req="$5"
  local resp
  resp=$(curl -sf -X POST "$BASE/event-types" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"key\":\"$key\",\"name\":\"$name\",\"description\":\"$desc\",\"schema\":$schema,\"requiresExposure\":$req}" 2>/dev/null) && {
    echo "$resp" | jq -r '.id'
    return
  }
  curl -sf "$BASE/event-types" -H "$AUTH" | jq -r ".data[] | select(.key==\"$key\") | .id"
}

upsert_metric() {
  local key="$1" name="$2" formula="$3"
  local resp
  resp=$(curl -sf -X POST "$BASE/metric-definitions" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"key\":\"$key\",\"name\":\"$name\",\"formula\":$formula}" 2>/dev/null) && {
    echo "$resp" | jq -r '.id'
    return
  }
  curl -sf "$BASE/metric-definitions" -H "$AUTH" | jq -r ".data[] | select(.key==\"$key\") | .id"
}

upsert_flag() {
  local key="$1" type="$2" default="$3" desc="$4"
  local resp
  resp=$(curl -sf -X POST "$BASE/flags" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"key\":\"$key\",\"valueType\":\"$type\",\"defaultValue\":\"$default\",\"description\":\"$desc\"}" 2>/dev/null) && {
    echo "$resp" | jq -r '.id'
    return
  }
  curl -sf "$BASE/flags" -H "$AUTH" | jq -r ".data[] | select(.key==\"$key\") | .id"
}

# ── wait for readiness ───────────────────────────────────
echo "=== Waiting for readiness ==="
for i in $(seq 1 90); do
  curl -sf "$BASE/ready" >/dev/null 2>&1 && {
    echo "System ready"
    break
  }
  [ "$i" -eq 90 ] && echo "FAIL: not ready after 180s" && exit 1
  sleep 2
done

# ── login ────────────────────────────────────────────────
echo "=== Login ==="
TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"SecurePass123"}' |
  jq -r '.accessToken')
AUTH="Authorization: Bearer $TOKEN"

# ── users ────────────────────────────────────────────────
echo "=== Create users ==="
EXPERIMENTER_ID=$(upsert_user "experimenter@example.com" "SecurePass123" "Demo Experimenter" "EXPERIMENTER")
echo "  experimenter=$EXPERIMENTER_ID"

APPROVER_ID=$(upsert_user "approver@example.com" "SecurePass123" "Demo Approver" "APPROVER")
echo "  approver=$APPROVER_ID"

VIEWER_ID=$(upsert_user "viewer@example.com" "SecurePass123" "Demo Viewer" "VIEWER")
echo "  viewer=$VIEWER_ID"

# ── approver group ───────────────────────────────────────
echo "=== Create approver group ==="
EXISTING_GROUP=$(curl -sf "$BASE/approver-groups" -H "$AUTH" | jq -r ".data[] | select(.ownerId==\"$EXPERIMENTER_ID\") | .id // empty" 2>/dev/null || true)
if [ -n "$EXISTING_GROUP" ]; then
  GROUP_ID="$EXISTING_GROUP"
  echo "  group=$GROUP_ID (already exists)"
else
  GROUP_ID=$(curl -sf -X POST "$BASE/approver-groups" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"ownerId\":\"$EXPERIMENTER_ID\",\"requiredApprovals\":1}" | jq -r '.id')
  curl -sf -X POST "$BASE/approver-groups/$GROUP_ID/members" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$APPROVER_ID\"}" >/dev/null
  echo "  group=$GROUP_ID (created, approver added)"
fi

# ── event types ──────────────────────────────────────────
echo "=== Create event types ==="
upsert_event_type "exposure" "Exposure" "Variant shown to user" '{}' false >/dev/null
echo "  exposure ✓"
upsert_event_type "button.clicked" "Button Clicked" "User clicked button" '{}' true >/dev/null
echo "  button.clicked ✓"
upsert_event_type "page.error" "Page Error" "Client error event" '{"type":"object","properties":{"latencyMs":{"type":"number"}}}' true >/dev/null
echo "  page.error ✓"

# ── metrics ──────────────────────────────────────────────
echo "=== Create metrics ==="
CLICK_RATE_ID=$(upsert_metric "click_rate" "Click Rate" '{"type":"RATIO","numeratorEventTypeKey":"button.clicked","denominatorEventTypeKey":"exposure"}')
echo "  click_rate=$CLICK_RATE_ID"

ERROR_RATE_ID=$(upsert_metric "error_rate" "Error Rate" '{"type":"RATIO","numeratorEventTypeKey":"page.error","denominatorEventTypeKey":"exposure"}')
echo "  error_rate=$ERROR_RATE_ID"

EXPOSURE_COUNT_ID=$(upsert_metric "exposure_count" "Exposure Count" '{"type":"COUNT","eventTypeKey":"exposure"}')
echo "  exposure_count=$EXPOSURE_COUNT_ID"

# ── flags ────────────────────────────────────────────────
echo "=== Create flags ==="
BUTTON_FLAG_ID=$(upsert_flag "button_color" "STRING" "green" "Color of the main CTA button")
echo "  button_color=$BUTTON_FLAG_ID"

NO_EXP_FLAG_ID=$(upsert_flag "no_exp_flag" "STRING" "fallback" "Flag without experiment for B2-1 demo")
echo "  no_exp_flag=$NO_EXP_FLAG_ID"

SEARCH_FLAG_ID=$(upsert_flag "search_algo" "STRING" "v1" "Search algorithm variant")
echo "  search_algo=$SEARCH_FLAG_ID"

# ── experiment ───────────────────────────────────────────
echo "=== Create experiment (button_color) ==="
EXP_TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"experimenter@example.com","password":"SecurePass123"}' |
  jq -r '.accessToken')
EXP_AUTH="Authorization: Bearer $EXP_TOKEN"

APPROVER_TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"approver@example.com","password":"SecurePass123"}' |
  jq -r '.accessToken')
APPROVER_AUTH="Authorization: Bearer $APPROVER_TOKEN"

# Check if there's already a running experiment on this flag
EXISTING_EXP=$(curl -sf "$BASE/experiments" -H "$AUTH" |
  jq -r "[.data[] | select(.flagId==\"$BUTTON_FLAG_ID\" and (.status==\"RUNNING\" or .status==\"PAUSED\" or .status==\"APPROVED\"))][0].id // empty")

if [ -n "$EXISTING_EXP" ]; then
  EXP_ID="$EXISTING_EXP"
  EXP_STATUS=$(curl -sf "$BASE/experiments/$EXP_ID" -H "$AUTH" | jq -r '.status')
  echo "  experiment=$EXP_ID (already exists, status=$EXP_STATUS)"
else
  EXP_ID=$(curl -sf -X POST "$BASE/experiments" \
    -H "$EXP_AUTH" -H 'Content-Type: application/json' \
    -d "{
      \"name\":\"Button Color A/B Test\",
      \"description\":\"Testing red vs green button for checkout CTR\",
      \"flagId\":\"$BUTTON_FLAG_ID\",
      \"audiencePercent\":100,
      \"variants\":[
        {\"name\":\"Control\",\"value\":\"green\",\"weight\":50,\"isControl\":true},
        {\"name\":\"Treatment\",\"value\":\"red\",\"weight\":50,\"isControl\":false}
      ],
      \"metricIds\":[\"$CLICK_RATE_ID\",\"$ERROR_RATE_ID\",\"$EXPOSURE_COUNT_ID\"],
      \"primaryMetricId\":\"$CLICK_RATE_ID\"
    }" | jq -r '.id')
  echo "  experiment=$EXP_ID (created)"

  echo "=== Add guardrail ==="
  curl -sf -X POST "$BASE/experiments/$EXP_ID/guardrails" \
    -H "$EXP_AUTH" -H 'Content-Type: application/json' \
    -d "{\"metricId\":\"$ERROR_RATE_ID\",\"threshold\":0.1,\"operator\":\"GT\",\"windowMinutes\":10,\"action\":\"PAUSE\"}" >/dev/null
  echo "  error_rate guardrail ✓"

  echo "=== Submit → Approve → Start ==="
  curl -sf -X POST "$BASE/experiments/$EXP_ID/submit" -H "$EXP_AUTH" >/dev/null
  echo "  submitted ✓"

  curl -sf -X POST "$BASE/experiments/$EXP_ID/approve" \
    -H "$APPROVER_AUTH" -H 'Content-Type: application/json' \
    -d '{"comment":"Looks good, metrics and guardrails configured"}' >/dev/null
  echo "  approved ✓"

  curl -sf -X POST "$BASE/experiments/$EXP_ID/start" -H "$EXP_AUTH" >/dev/null
  echo "  started ✓"
fi

echo "=== Wait for snapshot propagation ==="
sleep 4

echo "=== Verify decide works ==="
DECIDE_RESP=$(curl -sf -X POST "$BASE/decide" \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"seed-user-1","flagKeys":["button_color","no_exp_flag"]}')
echo "$DECIDE_RESP" | jq -c '.decisions[] | {flagKey, value, reason}'

echo ""
echo "============================================"
echo "  SEED COMPLETE ✅"
echo "============================================"
echo ""
echo "  Admin:        admin@example.com / SecurePass123"
echo "  Experimenter: experimenter@example.com / SecurePass123"
echo "  Approver:     approver@example.com / SecurePass123"
echo "  Viewer:       viewer@example.com / SecurePass123"
echo ""
echo "  Experiment:   $EXP_ID (RUNNING)"
echo "  Flag:         button_color (with experiment)"
echo "  Flag:         no_exp_flag (no experiment → default)"
echo "  Flag:         search_algo (spare, no experiment)"
echo ""
echo "  Metrics:      click_rate, error_rate, exposure_count"
echo "  Event types:  exposure, button.clicked, page.error"
echo "  Guardrail:    error_rate > 0.1 → PAUSE"
echo "============================================"
