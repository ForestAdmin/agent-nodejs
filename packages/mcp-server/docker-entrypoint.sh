#!/bin/sh
set -e

# Run the MCP server when invoked with no args. Any first token is treated as a
# command override (e.g. `docker run <image> node …` or `sh`) and exec'd as-is,
# so the image stays debuggable.
if [ "$#" -eq 0 ]; then
  exec node /app/packages/mcp-server/dist/cli.js
fi

exec "$@"
