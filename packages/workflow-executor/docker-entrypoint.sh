#!/bin/sh
set -e

# Run the executor when invoked with no args or only flags (e.g. `--in-memory`).
# Any other first token is treated as a command override (e.g. `docker run <image>
# node …` or `sh`) and exec'd as-is, so the image stays debuggable.
#
# --require loads tracing.js before any other module so OpenTelemetry can patch
# the runtime. tracing.js is a no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
if [ "$#" -eq 0 ] || [ "${1#-}" != "$1" ]; then
  exec node \
    --require /app/packages/workflow-executor/dist/tracing.js \
    /app/packages/workflow-executor/dist/cli.js \
    --json "$@"
fi

exec "$@"
