# syntax=docker/dockerfile:1
#
# Local/dev image for @forestadmin/workflow-executor.
# The build context MUST be the monorepo root (yarn workspaces + yarn.lock):
#
#   docker build -f packages/workflow-executor/Dockerfile -t forest-workflow-executor:local .
#
# It is NOT optimized for production (ships the full workspace node_modules).

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# --ignore-scripts skips husky, native (node-gyp) builds and binary downloads
# we don't need here: the runtime path is Postgres and `pg` is pure JS. The only
# native dep (sqlite3) is dev-only and unused at runtime.
COPY . .
RUN yarn install --frozen-lockfile --ignore-scripts

# Build the executor and only its workspace dependencies (6 packages), in order.
RUN node_modules/.bin/lerna run build \
      --scope @forestadmin/workflow-executor \
      --include-dependencies

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Hoisted node_modules symlink into packages/*, so the whole tree must come along
# for the @forestadmin/* workspace symlinks to resolve.
COPY --from=builder /app ./

USER node

# HTTP server (GET /runs/:runId, POST /runs/:runId/trigger). Override with HTTP_PORT.
EXPOSE 3400

CMD ["node", "packages/workflow-executor/dist/cli.js", "--json"]
