# syntax=docker/dockerfile:1
#
# Production image for @forestadmin/workflow-executor.
# The build context MUST be the monorepo root (yarn workspaces + yarn.lock):
#
#   docker build -f packages/workflow-executor/Dockerfile -t ghcr.io/forestadmin/workflow-executor:latest .
#
# Configuration is passed entirely via environment variables — see README for the full list.

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# --ignore-scripts skips husky, native (node-gyp) builds, and binary downloads
# that are irrelevant to this package (sqlite3 is dev-only and never loaded at runtime).
COPY . .
RUN yarn install --frozen-lockfile --ignore-scripts

# Build the executor and only its 5 workspace dependencies, in topological order.
RUN node_modules/.bin/lerna run build \
      --scope @forestadmin/workflow-executor \
      --include-dependencies

# ── Stage 2: isolated prod deps ───────────────────────────────────────────────
# Install only the external (non-@forestadmin) runtime deps of the 6 workspace
# packages into a clean, standalone node_modules. Avoids hoisting deps of the
# other 16 workspace packages and cuts the runtime image by ~50%.
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /deps

COPY packages/workflow-executor/package.json  ./pkg/workflow-executor.json
COPY packages/agent-client/package.json       ./pkg/agent-client.json
COPY packages/ai-proxy/package.json           ./pkg/ai-proxy.json
COPY packages/forestadmin-client/package.json ./pkg/forestadmin-client.json
COPY packages/datasource-toolkit/package.json ./pkg/datasource-toolkit.json
COPY packages/agent-toolkit/package.json      ./pkg/agent-toolkit.json

# Merge all external runtime deps into a single package.json.
# OTel packages are added explicitly for APM — not package deps (CLI users don't need them).
RUN node -e "const fs=require('fs');const deps={};for(const f of fs.readdirSync('pkg')){const {dependencies={}}=JSON.parse(fs.readFileSync('pkg/'+f,'utf8'));for(const [n,v] of Object.entries(dependencies)){if(!n.startsWith('@forestadmin/'))deps[n]=v;}}deps['@opentelemetry/sdk-node']='0.219.0';deps['@opentelemetry/auto-instrumentations-node']='0.77.0';deps['@opentelemetry/exporter-trace-otlp-http']='0.219.0';fs.writeFileSync('package.json',JSON.stringify({dependencies:deps},null,2));"

RUN yarn install --no-lockfile --ignore-scripts --production

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# External runtime deps (clean install, no monorepo workspace noise).
COPY --from=prod-deps /deps/node_modules ./node_modules

# @forestadmin/* workspace packages placed directly in node_modules.
# Node resolves them by walking up to /app/node_modules/@forestadmin/<pkg>/,
# where package.json's "main" field points into dist/.
COPY --from=builder /app/packages/agent-client/dist        ./node_modules/@forestadmin/agent-client/dist
COPY --from=builder /app/packages/agent-client/package.json ./node_modules/@forestadmin/agent-client/package.json
COPY --from=builder /app/packages/ai-proxy/dist             ./node_modules/@forestadmin/ai-proxy/dist
COPY --from=builder /app/packages/ai-proxy/package.json     ./node_modules/@forestadmin/ai-proxy/package.json
COPY --from=builder /app/packages/forestadmin-client/dist   ./node_modules/@forestadmin/forestadmin-client/dist
COPY --from=builder /app/packages/forestadmin-client/package.json ./node_modules/@forestadmin/forestadmin-client/package.json
COPY --from=builder /app/packages/datasource-toolkit/dist   ./node_modules/@forestadmin/datasource-toolkit/dist
COPY --from=builder /app/packages/datasource-toolkit/package.json ./node_modules/@forestadmin/datasource-toolkit/package.json
COPY --from=builder /app/packages/agent-toolkit/dist        ./node_modules/@forestadmin/agent-toolkit/dist
COPY --from=builder /app/packages/agent-toolkit/package.json ./node_modules/@forestadmin/agent-toolkit/package.json

# Executor entry point.
COPY --from=builder /app/packages/workflow-executor/dist        ./packages/workflow-executor/dist
COPY --from=builder /app/packages/workflow-executor/package.json ./packages/workflow-executor/package.json
COPY packages/workflow-executor/docker-entrypoint.sh ./docker-entrypoint.sh

USER node

# HTTP server (GET /health, GET /runs/:runId, POST /runs/:runId/trigger).
# Override with HTTP_PORT env var.
EXPOSE 3400

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]
