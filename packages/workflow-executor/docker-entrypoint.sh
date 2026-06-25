#!/bin/sh
set -e
# --require loads tracing.js before any other module so OpenTelemetry can patch
# the runtime. tracing.js is a no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
exec node \
  --require /app/packages/workflow-executor/dist/tracing.js \
  /app/packages/workflow-executor/dist/cli.js \
  --json "$@"
