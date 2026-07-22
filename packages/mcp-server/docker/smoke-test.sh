#!/bin/sh
# Smoke-test a built mcp-server image: prove the entrypoint works, the full module
# graph loads (cli.js → server.ts eagerly imports every @forestadmin + external
# dep), and the server boots far enough to answer its health probe.
# Run against a locally-loaded image before it is published.
#
# Boot needs no reachable Forest server — env discovery and schema fetch both
# degrade gracefully (warn, don't throw), so the server still listens.
#
# Usage: smoke-test.sh <image-ref>
set -eu

IMAGE="${1:?usage: smoke-test.sh <image-ref>}"
PORT=3931
NAME="mcp-server-smoke-$$"

cleanup() {
  logs="$(docker logs "$NAME" 2>&1 || true)"
  echo "$logs"
  docker rm -f "$NAME" >/dev/null 2>&1 || true

  if echo "$logs" | grep -qiE "Cannot find module|MODULE_NOT_FOUND"; then
    echo "::error::module resolution failure in the image"
    exit 1
  fi
}
trap cleanup EXIT

docker run -d --name "$NAME" \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e MCP_SERVER_PORT="$PORT" \
  "$IMAGE" >/dev/null

# Health probe from inside the container (node is always present — no host curl
# or published port needed). A missing module or boot crash never reaches 200.
i=0
until docker exec "$NAME" node -e "require('http').get('http://localhost:$PORT/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "::error::mcp-server did not answer /health within 30s — boot/module failure"
    exit 1
  fi
  sleep 1
done

if ! docker logs "$NAME" 2>&1 | grep -q "Forest Admin MCP Server running"; then
  echo "::error::server did not log its startup marker"
  exit 1
fi

echo "smoke test passed for $IMAGE"
