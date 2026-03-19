#!/bin/sh
set -eu

COMPOSE_FILE="docker-compose.dev.yml"
COMPOSE_PROFILE="test"

docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILE" up -d \
  postgres \
  redis \
  kafka \
  kafka-init \
  clickhouse \
  clickhouse-bootstrap

docker compose -f "$COMPOSE_FILE" --profile "$COMPOSE_PROFILE" run --rm --no-deps --use-aliases \
  test-runner sh -lc '
set -eu
bun install --frozen-lockfile >/dev/null
bunx prisma db push >/dev/null
mkdir -p .cache/openapi

run_one() {
  name="$1"
  port="$2"
  entry="$3"

  PORT="$port" bun "$entry" >"/tmp/$name-openapi.log" 2>&1 &
  pid="$!"

  i=0
  while [ "$i" -lt 120 ]; do
    if wget -qO ".cache/openapi/$name.json" "http://127.0.0.1:$port/openapi.json"; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done

  echo "failed to fetch /openapi.json for $name" >&2
  tail -200 "/tmp/$name-openapi.log" >&2 || true
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
  exit 1
}

run_one control 4101 src/apps/control-api/main.ts
run_one decide 4102 src/apps/decide-api/main.ts
run_one ingest 4103 src/apps/ingest-api/main.ts
'

bunx @redocly/cli lint --config .redocly.yaml \
  .cache/openapi/control.json \
  .cache/openapi/decide.json \
  .cache/openapi/ingest.json
