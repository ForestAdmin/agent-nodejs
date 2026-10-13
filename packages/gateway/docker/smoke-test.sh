#!/bin/sh
set -eu

IMAGE="${1:?usage: smoke-test.sh <image-ref>}"
CLI=/app/packages/gateway/dist/cli.js
PORT=13931
STUB_PORT=13932
TMP_DIR=$(mktemp -d)

docker run --rm "$IMAGE" --version
docker run --rm "$IMAGE" --help > "$TMP_DIR/help.txt"
grep -q "Usage: forest-gateway" "$TMP_DIR/help.txt"

docker run --rm --entrypoint node "$IMAGE" -e "require('$CLI')"

docker run --rm --entrypoint node "$IMAGE" \
  -e "require('fs').accessSync('/app/node_modules/@forestadmin/agent-bff/dist/docs/redoc.standalone.js')"

docker run --rm "$IMAGE" openapi > "$TMP_DIR/openapi.json"
grep -q '"openapi"' "$TMP_DIR/openapi.json"

docker run --rm --entrypoint sh "$IMAGE" -c \
  "node $CLI openapi --output && test -s /app/openapi.json"

CONTAINER=""
STUB_PID=""
cleanup() {
  [ -n "$CONTAINER" ] && docker logs "$CONTAINER" 2>&1 || true
  [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  [ -n "$STUB_PID" ] && kill "$STUB_PID" 2>/dev/null || true
  [ -n "$STUB_PID" ] && wait "$STUB_PID" 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_probed() {
  docker run -d --health-interval=1s --health-start-period=0s --health-retries=1 "$@" "$IMAGE"
}

wait_health() {
  expected="$1"
  health=""
  attempt=0
  while [ "$attempt" -lt 90 ]; do
    health=$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}')
    [ "$health" = "$expected" ] && return 0
    attempt=$((attempt + 1))
    sleep 1
  done
  echo "::error::the Docker HEALTHCHECK reported '$health', expected '$expected'"
  docker inspect "$CONTAINER" --format '{{json .State.Health}}' || true
  return 1
}

wait_probe_output() {
  expected="$1"
  output=""
  attempt=0
  while [ "$attempt" -lt 90 ]; do
    output=$(docker inspect "$CONTAINER" --format '{{with .State.Health}}{{range .Log}}{{.Output}}{{end}}{{end}}')
    case "$output" in *"$expected"*) return 0 ;; esac
    attempt=$((attempt + 1))
    sleep 1
  done
  echo "::error::the Docker HEALTHCHECK never reported '$expected'"
  docker inspect "$CONTAINER" --format '{{json .State.Health}}' || true
  return 1
}

wait_http() {
  url="$1"
  out="$2"
  until_code="$3"
  code=""
  attempt=0
  while [ "$attempt" -lt 90 ]; do
    code=$(curl -s -o "$out" -w '%{http_code}' "$url" || true)
    if [ -n "$until_code" ]; then
      [ "$code" = "$until_code" ] && break
    else
      [ "$code" != "000" ] && [ -n "$code" ] && break
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  echo "$code"
}

expect_in() {
  file="$1"
  needle="$2"
  message="$3"
  if ! grep -q "$needle" "$file"; then
    echo "::error::$message"
    cat "$file"
    exit 1
  fi
}

stop_container() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  CONTAINER=""
}

CONTAINER=$(run_probed -p "127.0.0.1:$PORT:3931" \
  -e FOREST_GATEWAY_SERVICES=mcp,api \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL=http://127.0.0.1:1 \
  -e FOREST_APP_URL=http://127.0.0.1:1 \
  -e FOREST_AGENT_URL=http://127.0.0.1:1 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318)

status=$(wait_http "http://127.0.0.1:$PORT/health" "$TMP_DIR/health.json" "")
docker logs "$CONTAINER" > "$TMP_DIR/boot.log" 2>&1

if grep -qiE "Cannot find module|MODULE_NOT_FOUND" "$TMP_DIR/boot.log"; then
  echo "::error::module resolution failure in the image"
  exit 1
fi
expect_in "$TMP_DIR/boot.log" "Forest Gateway started" "the Gateway did not reach startup — boot failure"
expect_in "$TMP_DIR/boot.log" "OpenTelemetry tracing enabled" \
  "the OTel SDK did not initialise — packages missing from the image?"
grep "OpenTelemetry tracing enabled" "$TMP_DIR/boot.log" > "$TMP_DIR/otel.log"
expect_in "$TMP_DIR/otel.log" "forest-gateway" "traces are not named forest-gateway"

if [ "$status" != "200" ]; then
  echo "::error::/health answered '$status', expected 200"
  cat "$TMP_DIR/health.json" 2>/dev/null || true
  exit 1
fi
expect_in "$TMP_DIR/health.json" '"mcp":"ok"' "/health does not report the MCP as ok"
expect_in "$TMP_DIR/health.json" '"oauth":false' \
  "/health does not report API OAuth as unconfigured without a token encryption key"

for path in /api/docs /api/docs/redoc.standalone.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$path")
  if [ "$code" != "200" ]; then
    echo "::error::$path answered '$code', expected 200"
    exit 1
  fi
done

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/mcp")
if [ "$code" != "401" ]; then
  echo "::error::POST /mcp without a token answered '$code', expected 401"
  exit 1
fi

wait_health healthy
echo "mcp,api without PORT: HEALTHCHECK healthy on 3931"
stop_container

CONTAINER=$(run_probed \
  -e FOREST_GATEWAY_SERVICES=mcp \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL=http://127.0.0.1:1)
wait_health healthy
echo "mcp without PORT: HEALTHCHECK healthy on 3931"
stop_container

CONTAINER=$(run_probed \
  -e FOREST_GATEWAY_SERVICES=api \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL=http://127.0.0.1:1 \
  -e FOREST_APP_URL=http://127.0.0.1:1 \
  -e FOREST_AGENT_URL=http://127.0.0.1:1)
wait_health healthy
echo "api without PORT: HEALTHCHECK healthy on 3450"
stop_container

CONTAINER=$(run_probed \
  -e FOREST_GATEWAY_SERVICES=api \
  -e HTTP_PORT=8080 \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL=http://127.0.0.1:1 \
  -e FOREST_APP_URL=http://127.0.0.1:1 \
  -e FOREST_AGENT_URL=http://127.0.0.1:1)
wait_health healthy
echo "api with HTTP_PORT=8080: HEALTHCHECK healthy"
stop_container

CONTAINER=$(run_probed \
  -e FOREST_GATEWAY_SERVICES=mcp \
  -e FOREST_SERVER_URL=http://127.0.0.1:1)
wait_probe_output "/health on port 3931 answered 503"
wait_health unhealthy
echo "mcp without its secrets: HEALTHCHECK unhealthy on a 503"
stop_container

STUB_DIR="$TMP_DIR/stub"
mkdir -p "$STUB_DIR/liana"
printf '{"data":{"id":1}}' > "$STUB_DIR/liana/environment"
python3 -m http.server "$STUB_PORT" --bind 0.0.0.0 --directory "$STUB_DIR" >/dev/null 2>&1 &
STUB_PID=$!

stub_up=$(wait_http "http://127.0.0.1:$STUB_PORT/liana/environment" /dev/null 200)
if [ "$stub_up" != "200" ]; then
  echo "::error::the Forest server stub did not come up on $STUB_PORT (answered '$stub_up')"
  exit 1
fi

CONTAINER=$(docker run -d -p "127.0.0.1:$PORT:3931" \
  --add-host "smoke-host:host-gateway" \
  -e FOREST_GATEWAY_SERVICES=mcp,api \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL="http://smoke-host:$STUB_PORT" \
  -e FOREST_APP_URL=http://127.0.0.1:1 \
  -e FOREST_AGENT_URL=http://127.0.0.1:1 \
  -e FOREST_GATEWAY_API_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 \
  "$IMAGE")

status=$(wait_http "http://127.0.0.1:$PORT/health" "$TMP_DIR/health-ok.json" 200)
if [ "$status" != "200" ]; then
  echo "::error::/health answered '$status' with a complete configuration, expected 200"
  cat "$TMP_DIR/health-ok.json" 2>/dev/null || true
  exit 1
fi
expect_in "$TMP_DIR/health-ok.json" '"healthy":true' "/health body is not the healthy payload"
expect_in "$TMP_DIR/health-ok.json" '"oauth":true' \
  "/health does not report API OAuth as configured with a complete configuration"

STOP_STARTED=$(date +%s)
docker stop -t 30 "$CONTAINER" >/dev/null
STOP_ELAPSED=$(( $(date +%s) - STOP_STARTED ))
STOP_CODE=$(docker inspect "$CONTAINER" --format '{{.State.ExitCode}}')

if [ "$STOP_CODE" != "0" ]; then
  echo "::error::the container exited $STOP_CODE on docker stop, expected 0 (137 means it was SIGKILLed)"
  exit 1
fi
if [ "$STOP_ELAPSED" -gt 8 ]; then
  echo "::error::shutdown took ${STOP_ELAPSED}s; the shutdown is no longer bounded"
  exit 1
fi

echo "graceful shutdown with an unreachable collector: exit 0 in ${STOP_ELAPSED}s"
stop_container
echo "smoke test passed for $IMAGE"
