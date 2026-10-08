# syntax=docker/dockerfile:1
#
# Production image for @forestadmin/gateway: the MCP, the API, or both, on one port.
# The build context MUST be the monorepo root (yarn workspaces + yarn.lock):
#
#   docker build -f packages/gateway/Dockerfile -t ghcr.io/forestadmin/gateway:latest .
#
# Configuration is passed entirely via environment variables; FOREST_GATEWAY_SERVICES
# (mcp, api or mcp,api) is required.

# Base image pinned by digest (node:22-bookworm-slim). Bump via Renovate/Dependabot.
FROM node:22-bookworm-slim@sha256:813a7480f28fdadac1f7f5c824bcdad435b5bc1322a5968bbbdef8d058f9dff4 AS base

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Same install as the agent-bff image: manifests + lockfile first so a source-only
# change keeps the install layer cached, --frozen-lockfile so the tree matches
# yarn.lock, --ignore-scripts to skip husky and native builds never loaded here.
COPY --parents package.json yarn.lock packages/*/package.json packages/*/*/package.json ./
RUN yarn install --frozen-lockfile --ignore-scripts

COPY . .

# Build the Gateway and only its 6 workspace dependencies, in topological order.
# agent-bff's `build` also copies the Redoc bundle into dist/docs.
RUN node_modules/.bin/lerna run build \
      --scope @forestadmin/gateway \
      --include-dependencies

# ── Stage 2: isolated prod deps ───────────────────────────────────────────────
# Only the external runtime deps of the 7 workspace packages, from the committed
# lockfile (see docker/README.md): a dependency change it does not cover fails here.
FROM base AS prod-deps
WORKDIR /deps

COPY packages/gateway/docker/build-deps-manifest.js ./build-deps-manifest.js
COPY packages/gateway/docker/deps/yarn.lock ./yarn.lock
COPY packages/gateway/package.json            ./packages/gateway/package.json
COPY packages/agent-bff/package.json          ./packages/agent-bff/package.json
COPY packages/agent-client/package.json       ./packages/agent-client/package.json
COPY packages/agent-toolkit/package.json      ./packages/agent-toolkit/package.json
COPY packages/datasource-toolkit/package.json ./packages/datasource-toolkit/package.json
COPY packages/forestadmin-client/package.json ./packages/forestadmin-client/package.json
COPY packages/mcp-server/package.json         ./packages/mcp-server/package.json

RUN node build-deps-manifest.js packages package.json
RUN yarn install --frozen-lockfile --ignore-scripts

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The digest pin freezes Debian packages too, so security fixes can only land here. APT_EPOCH is
# part of this layer's cache key: CI passes the run id so every run refetches; local builds reuse
# the cached layer until --no-cache.
ARG APT_EPOCH
RUN echo "$APT_EPOCH" \
  && apt-get update -o APT::Update::Error-Mode=any \
  && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --with-new-pkgs -o Dpkg::Options::=--force-confold \
  && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /deps/node_modules ./node_modules

# @forestadmin/* workspace packages placed directly in node_modules, resolved by
# walking up to /app/node_modules/@forestadmin/<pkg>/ and its package.json "main".
COPY --from=builder /app/packages/agent-bff/dist            ./node_modules/@forestadmin/agent-bff/dist
COPY --from=builder /app/packages/agent-bff/package.json    ./node_modules/@forestadmin/agent-bff/package.json
COPY --from=builder /app/packages/agent-client/dist         ./node_modules/@forestadmin/agent-client/dist
COPY --from=builder /app/packages/agent-client/package.json ./node_modules/@forestadmin/agent-client/package.json
COPY --from=builder /app/packages/agent-toolkit/dist        ./node_modules/@forestadmin/agent-toolkit/dist
COPY --from=builder /app/packages/agent-toolkit/package.json ./node_modules/@forestadmin/agent-toolkit/package.json
COPY --from=builder /app/packages/datasource-toolkit/dist   ./node_modules/@forestadmin/datasource-toolkit/dist
COPY --from=builder /app/packages/datasource-toolkit/package.json ./node_modules/@forestadmin/datasource-toolkit/package.json
COPY --from=builder /app/packages/forestadmin-client/dist   ./node_modules/@forestadmin/forestadmin-client/dist
COPY --from=builder /app/packages/forestadmin-client/package.json ./node_modules/@forestadmin/forestadmin-client/package.json
COPY --from=builder /app/packages/mcp-server/dist           ./node_modules/@forestadmin/mcp-server/dist
COPY --from=builder /app/packages/mcp-server/package.json   ./node_modules/@forestadmin/mcp-server/package.json

# Gateway entry point.
COPY --from=builder /app/packages/gateway/dist         ./packages/gateway/dist
COPY --from=builder /app/packages/gateway/package.json ./packages/gateway/package.json

# The working directory, and only it: `openapi --output` defaults to ./openapi.json. Not
# recursive — node_modules and dist stay root-owned, so the process cannot rewrite its code.
RUN chown node:node /app

USER node

# Not `forestadmin-agent-bff`, the default of the preload this image borrows from agent-bff.
# Setting OTEL_SERVICE_NAME at run time still wins.
ENV OTEL_SERVICE_NAME=forest-gateway

# 3931 when the mcp service is on, 3450 with api only; PORT overrides both. A real port only:
# with PORT=0 nothing outside the process learns the port, and the healthcheck fails.
EXPOSE 3450 3931

# The probe resolves the port the way the Gateway does (PORT, then its legacy aliases, then the
# per-service default), so the two never disagree. Only a 200 passes: a degraded service makes
# /health answer 503, and a misconfigured container is meant to read unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "/app/packages/gateway/dist/healthcheck.js"]

# OCI image metadata (https://github.com/opencontainers/image-spec).
LABEL org.opencontainers.image.title="forestadmin-gateway" \
      org.opencontainers.image.description="Forest Admin MCP and API services on one port." \
      org.opencontainers.image.source="https://github.com/ForestAdmin/agent-nodejs" \
      org.opencontainers.image.licenses="GPL-3.0"

# Exec form, no wrapper script: the CLI takes positional subcommands (`openapi`).
#
# The preload is agent-bff's, required from the same path the Gateway imports agent-bff by, so
# the tracing handle it parks is the one the shutdown path flushes. Inert until an OTLP endpoint
# or OTEL_TRACES_EXPORTER is set.
ENTRYPOINT ["node", "--require", "/app/node_modules/@forestadmin/agent-bff/dist/tracing-preload.js", "/app/packages/gateway/dist/cli.js"]
