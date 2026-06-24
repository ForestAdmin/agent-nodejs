#!/bin/sh
set -e
# --require loads tracing.js before any other module so dd-trace can patch the runtime.
# tracing.js is a no-op when ACTIVATE_TRACING is unset or 0.
exec node \
  --require /app/packages/workflow-executor/dist/tracing.js \
  /app/packages/workflow-executor/dist/cli.js \
  --json "$@"
