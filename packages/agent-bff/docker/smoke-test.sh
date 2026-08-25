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

# The docs page and its bundle are public routes; a 200 proves the asset is served,
# not merely present on disk.
bundle=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/docs/redoc.standalone.js")
if [ "$bundle" != "200" ]; then
  echo "::error::/docs/redoc.standalone.js answered '$bundle', expected 200"
  exit 1
fi

echo "smoke test passed for $IMAGE"
