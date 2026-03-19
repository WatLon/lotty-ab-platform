#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CONTROL_API_BASE_URL:-http://localhost}"
EMAIL="${GRAFANA_REPORTS_EMAIL:-${BOOTSTRAP_ADMIN_EMAIL:-admin@example.com}}"
PASSWORD="${GRAFANA_REPORTS_PASSWORD:-${BOOTSTRAP_ADMIN_PASSWORD:-SecurePass123}}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose --profile observability}"

if $COMPOSE_CMD ps --status running control-api >/dev/null 2>&1; then
  response="$(
    $COMPOSE_CMD exec -T \
      -e GRAFANA_REPORTS_EMAIL="$EMAIL" \
      -e GRAFANA_REPORTS_PASSWORD="$PASSWORD" \
      control-api sh -lc \
      'wget -qO- --header="Content-Type: application/json" --post-data="{\"email\":\"$GRAFANA_REPORTS_EMAIL\",\"password\":\"$GRAFANA_REPORTS_PASSWORD\"}" http://127.0.0.1:3000/auth/login'
  )"
else
  response="$({
    curl -fsS -X POST "${BASE_URL}/auth/login" \
      -H 'Content-Type: application/json' \
      --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}";
  } )"
fi

token="$(printf '%s' "$response" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
expires_in="$(printf '%s' "$response" | sed -n 's/.*"expiresIn":\([0-9][0-9]*\).*/\1/p')"

if [[ -z "$token" ]]; then
  echo "Failed to parse accessToken from login response" >&2
  echo "Response: $response" >&2
  exit 1
fi

echo "GRAFANA_REPORTS_BEARER_TOKEN=${token}"
if [[ -n "$expires_in" ]]; then
  echo "expires_in_seconds=${expires_in}" >&2
fi
