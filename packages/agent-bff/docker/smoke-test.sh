#!/bin/sh
# Smoke-test a built agent-bff image: prove the entrypoint works, the full module
# graph loads (cli.js eagerly imports cli-core -> every @forestadmin + external
# dep), the Redoc bundle shipped, and the server boots and answers.
# Run against a locally-loaded image before it is published.
#
# Usage: smoke-test.sh <image-ref>
set -eu

IMAGE="${1:?usage: smoke-test.sh <image-ref>}"
CLI=/app/packages/agent-bff/dist/cli.js
PORT=13450

# Entrypoint + CLI surface. Each output is captured before it is matched rather than
# piped into `grep -q`, which closes the pipe on its first hit and leaves the
# container writing to a broken one.
docker run --rm "$IMAGE" --version
docker run --rm "$IMAGE" --help > /tmp/bff-help.txt
grep -q "Usage: forest-bff" /tmp/bff-help.txt

# Module graph: requiring the entry point pulls cli-core and, through it, every
# @forestadmin package and external dependency. A missing module fails here.
# (`require.main !== module` under -e, so nothing is dispatched.)
docker run --rm --entrypoint node "$IMAGE" -e "require('$CLI')"

# The Redoc viewer is served from a bundle copied at build time (`build:copy`).
# A dist without it silently degrades the docs page to a 404.
docker run --rm --entrypoint node "$IMAGE" \
  -e "require('fs').accessSync('/app/packages/agent-bff/dist/docs/redoc.standalone.js')"

# The openapi command runs with no configuration at all and must emit a document.
docker run --rm "$IMAGE" openapi > /tmp/bff-openapi.json
grep -q '"openapi"' /tmp/bff-openapi.json

# Boot with everything the agent edge needs EXCEPT the token encryption key: the
# whole middleware chain (permissions, data, action, OpenAPI, docs) is built and
# nothing reaches the network, whereas a fully configured boot would fetch the
# environment id from FOREST_SERVER_URL and die on an unreachable host.
# /health therefore reports `degraded` — the point is that it answers at all.
CONTAINER=$(docker run -d -p "127.0.0.1:$PORT:3450" \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL=http://127.0.0.1:1 \
  -e FOREST_APP_URL=http://127.0.0.1:1 \
  -e AGENT_URL=http://127.0.0.1:1 \
  "$IMAGE")
trap 'docker logs "$CONTAINER" 2>&1 || true; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

status=""
attempt=0
while [ "$attempt" -lt 30 ]; do
  status=$(curl -s -o /tmp/bff-health.json -w '%{http_code}' "http://127.0.0.1:$PORT/health" || true)
  [ "$status" != "000" ] && [ -n "$status" ] && break
  attempt=$((attempt + 1))
  sleep 1
done

logs=$(docker logs "$CONTAINER" 2>&1)

if echo "$logs" | grep -qiE "Cannot find module|MODULE_NOT_FOUND"; then
  echo "::error::module resolution failure in the image"
  exit 1
fi
if ! echo "$logs" | grep -q "Forest BFF started"; then
  echo "::error::the BFF did not reach startup — boot failure"
  exit 1
fi
if [ "$status" != "503" ]; then
  echo "::error::/health answered '$status', expected 503 (degraded: no BFF_TOKEN_ENCRYPTION_KEY)"
  cat /tmp/bff-health.json 2>/dev/null || true
  exit 1
fi
if ! grep -q '"status":"degraded"' /tmp/bff-health.json; then
  echo "::error::/health body is not the degraded payload"
  cat /tmp/bff-health.json
  exit 1
fi

# The viewer and its bundle are public routes. The bundle proves the asset is served
# and not merely present on disk; the page itself is what a user actually opens, and
# it is rendered separately.
for path in /docs /docs/redoc.standalone.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$path")
  if [ "$code" != "200" ]; then
    echo "::error::$path answered '$code', expected 200"
    exit 1
  fi
done

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
trap - EXIT

# Second boot, fully configured, to reach /health 200. Nothing else proves that path:
# the image's own HEALTHCHECK demands a 200, so a regression making `hasAllRequired`
# always false would leave every published container permanently unhealthy with CI
# still green.
#
# A complete configuration makes the BFF fetch its environment id from
# FOREST_SERVER_URL at boot and die if that host is unreachable, so a stub answers
# /liana/environment. It is served over host-gateway rather than from a second
# container, which keeps this to curl, openssl and python3.
STUB_PORT=13451
STUB_DIR=$(mktemp -d)
mkdir -p "$STUB_DIR/liana"
printf '{"data":{"id":1}}' > "$STUB_DIR/liana/environment"
# --directory rather than a `cd` subshell: `$!` must be python's own pid, or the
# kill below reaps the subshell and leaves the server holding the port.
python3 -m http.server "$STUB_PORT" --bind 127.0.0.1 --directory "$STUB_DIR" >/dev/null 2>&1 &
STUB_PID=$!

CONTAINER=""
cleanup() {
  [ -n "$CONTAINER" ] && docker logs "$CONTAINER" 2>&1 || true
  [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  # `wait` reaps the stub inside this redirect, so the shell does not report the
  # terminated job on its own after the script has already printed its result.
  kill "$STUB_PID" 2>/dev/null || true
  wait "$STUB_PID" 2>/dev/null || true
  rm -rf "$STUB_DIR"
}
trap cleanup EXIT

stub_up=""
attempt=0
while [ "$attempt" -lt 15 ]; do
  stub_up=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$STUB_PORT/liana/environment" || true)
  [ "$stub_up" = "200" ] && break
  attempt=$((attempt + 1))
  sleep 1
done
if [ "$stub_up" != "200" ]; then
  echo "::error::the Forest server stub did not come up on $STUB_PORT (answered '$stub_up')"
  exit 1
fi

rm -f /tmp/bff-health-ok.json

CONTAINER=$(docker run -d -p "127.0.0.1:$PORT:3450" \
  --add-host "smoke-host:host-gateway" \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_SERVER_URL="http://smoke-host:$STUB_PORT" \
  -e FOREST_APP_URL=http://127.0.0.1:1 \
  -e AGENT_URL=http://127.0.0.1:1 \
  -e BFF_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  "$IMAGE")

status=""
attempt=0
while [ "$attempt" -lt 30 ]; do
  status=$(curl -s -o /tmp/bff-health-ok.json -w '%{http_code}' "http://127.0.0.1:$PORT/health" || true)
  [ "$status" = "200" ] && break
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$status" != "200" ]; then
  echo "::error::/health answered '$status' with a complete configuration, expected 200"
  cat /tmp/bff-health-ok.json 2>/dev/null || true
  docker logs "$CONTAINER" 2>&1 || true
  exit 1
fi
if ! grep -q '"status":"ok"' /tmp/bff-health-ok.json; then
  echo "::error::/health body is not the ok payload"
  cat /tmp/bff-health-ok.json
  exit 1
fi

echo "smoke test passed for $IMAGE"
