#!/bin/sh
# Smoke-test a built workflow-executor image: prove the entrypoint works, the full
# module graph loads (cli.js eagerly imports build-workflow-executor → every
# @forestadmin + external dep + the OTel SDK), and the executor boots.
# Run against a locally-loaded image before it is published.
#
# Usage: smoke-test.sh <image-ref>
set -eu

IMAGE="${1:?usage: smoke-test.sh <image-ref>}"

# Entrypoint + module graph: a missing module/dep fails here (non-zero exit).
docker run --rm "$IMAGE" --version
docker run --rm "$IMAGE" --help | grep -q "Usage:"

# Boot far enough to prove all runtime modules load and the OTel SDK initialises.
# The agent probe fails (no agent) — expected — so we assert on log markers.
out="$(docker run --rm \
  -e FOREST_ENV_SECRET="$(openssl rand -hex 32)" \
  -e FOREST_AUTH_SECRET=smoke-test \
  -e AGENT_URL=http://127.0.0.1:1 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 \
  "$IMAGE" --in-memory --json 2>&1 || true)"
echo "$out"

if ! echo "$out" | grep -q "Workflow executor starting"; then
  echo "::error::executor did not reach startup — boot/module failure"
  exit 1
fi
if echo "$out" | grep -qiE "Cannot find module|MODULE_NOT_FOUND"; then
  echo "::error::module resolution failure in the image"
  exit 1
fi
if echo "$out" | grep -q "OpenTelemetry packages not available"; then
  echo "::error::OTel packages missing from the image"
  exit 1
fi

echo "smoke test passed for $IMAGE"
