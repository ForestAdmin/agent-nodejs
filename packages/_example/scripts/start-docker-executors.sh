#!/usr/bin/env bash
# Starts the multi-instance docker executors (nginx gateway on :3400), configured ENTIRELY from
# packages/_example/.env. Invoked by the start:with-executor:multiple-instance[:build] scripts.
#
# The executor example's own `executors` script stays config-agnostic (pure `docker compose up`):
# this wrapper sources _example/.env, translates host-local URLs so the containers can reach the
# host, waits for the agent, then delegates. Run standalone from the executor example dir to use
# that package's own .env instead.
set -euo pipefail
set -a
# shellcheck disable=SC1091
source .env

# localhost / 127.0.0.1 -> host.docker.internal (containers reach services on the host).
to_host() {
  local v="${1/localhost/host.docker.internal}"
  echo "${v/127.0.0.1/host.docker.internal}"
}

AGENT_URL="$(to_host "$EXECUTOR_AGENT_URL")"
DATABASE_URL="$(to_host "$EXECUTOR_DATABASE_URL")"
FOREST_SERVER_URL="$(to_host "${FOREST_SERVER_URL:-}")"

# Executors probe AGENT_URL on startup — wait for the host agent first (avoids restart noise).
until curl -s "$EXECUTOR_AGENT_URL" >/dev/null 2>&1; do sleep 1; done

# Exported vars above are inherited by docker compose interpolation in the example package.
yarn workspace workflow-executor-example "${1:-executors}"
