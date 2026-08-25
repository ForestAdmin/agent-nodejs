# syntax=docker/dockerfile:1
#
# Production image for @forestadmin/agent-bff.
# The build context MUST be the monorepo root (yarn workspaces + yarn.lock):
#
#   docker build -f packages/agent-bff/Dockerfile -t ghcr.io/forestadmin/agent-bff:latest .
#
# Configuration is passed entirely via environment variables — see README for the full list.

# Base image pinned by digest for reproducible builds (node:22-bookworm-slim).
# Bump via Renovate/Dependabot.
FROM node:22-bookworm-slim@sha256:813a7480f28fdadac1f7f5c824bcdad435b5bc1322a5968bbbdef8d058f9dff4 AS base

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Install from manifests + lockfile only (before the source COPY) so editing
# source doesn't bust the install layer — keeps the install cached on
# source-only changes (CI cache-warm + local rebuilds). --parents preserves the
# packages/*/ layout that yarn workspaces needs.
# --frozen-lockfile guarantees the resolved tree matches yarn.lock exactly.
# --ignore-scripts skips husky, native (node-gyp) builds, and binary downloads
# irrelevant here (sqlite3 is dev-only and never loaded at runtime).
COPY --parents package.json yarn.lock packages/*/package.json packages/workflow-executor/example/package.json ./
RUN yarn install --frozen-lockfile --ignore-scripts

COPY . .

# Build the BFF and only its 4 workspace dependencies, in topological order.
# `build` also copies the Redoc bundle into dist/docs (see build:copy).
RUN node_modules/.bin/lerna run build \
      --scope @forestadmin/agent-bff \
      --include-dependencies

# ── Stage 2: isolated prod deps ───────────────────────────────────────────────
# Install only the image's runtime deps (external deps of the 5 workspace packages)
# into a clean, standalone node_modules. Avoids hoisting deps of the other workspace
# packages and cuts the runtime image substantially.
#
# The manifest is regenerated from the live package.json files; the committed
# yarn.lock pins every (transitive) version. --frozen-lockfile makes a workspace
# dependency change that the lock does not cover fail the build instead of
# silently shipping an unpinned version.
FROM base AS prod-deps
WORKDIR /deps

COPY packages/agent-bff/docker/build-deps-manifest.js ./build-deps-manifest.js
COPY packages/agent-bff/docker/deps/yarn.lock ./yarn.lock
COPY packages/agent-bff/package.json          ./packages/agent-bff/package.json
COPY packages/agent-client/package.json       ./packages/agent-client/package.json
COPY packages/agent-toolkit/package.json      ./packages/agent-toolkit/package.json
COPY packages/datasource-toolkit/package.json ./packages/datasource-toolkit/package.json
COPY packages/forestadmin-client/package.json ./packages/forestadmin-client/package.json

RUN node build-deps-manifest.js packages package.json
RUN yarn install --frozen-lockfile --ignore-scripts

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# External runtime deps (clean, reproducible install — no monorepo workspace noise).
COPY --from=prod-deps /deps/node_modules ./node_modules

# @forestadmin/* workspace packages placed directly in node_modules.
# Node resolves them by walking up to /app/node_modules/@forestadmin/<pkg>/,
# where package.json's "main" field points into dist/.
COPY --from=builder /app/packages/agent-client/dist         ./node_modules/@forestadmin/agent-client/dist
COPY --from=builder /app/packages/agent-client/package.json ./node_modules/@forestadmin/agent-client/package.json
COPY --from=builder /app/packages/agent-toolkit/dist        ./node_modules/@forestadmin/agent-toolkit/dist
COPY --from=builder /app/packages/agent-toolkit/package.json ./node_modules/@forestadmin/agent-toolkit/package.json
COPY --from=builder /app/packages/datasource-toolkit/dist   ./node_modules/@forestadmin/datasource-toolkit/dist
COPY --from=builder /app/packages/datasource-toolkit/package.json ./node_modules/@forestadmin/datasource-toolkit/package.json
COPY --from=builder /app/packages/forestadmin-client/dist   ./node_modules/@forestadmin/forestadmin-client/dist
COPY --from=builder /app/packages/forestadmin-client/package.json ./node_modules/@forestadmin/forestadmin-client/package.json

# BFF entry point. dist/docs carries the Redoc bundle the docs page serves.
COPY --from=builder /app/packages/agent-bff/dist         ./packages/agent-bff/dist
COPY --from=builder /app/packages/agent-bff/package.json ./packages/agent-bff/package.json

USER node

# HTTP server (GET /health, the /agent edge, GET /docs).
# Override with the HTTP_PORT env var.
EXPOSE 3450

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.HTTP_PORT||3450)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# OCI image metadata (https://github.com/opencontainers/image-spec).
LABEL org.opencontainers.image.title="forestadmin-agent-bff" \
      org.opencontainers.image.description="Backend-for-frontend for Forest Admin agents." \
      org.opencontainers.image.source="https://github.com/ForestAdmin/agent-nodejs" \
      org.opencontainers.image.licenses="GPL-3.0"

# Exec form, no wrapper script: the CLI takes positional subcommands (`openapi`),
# so a "is the first argument a flag?" wrapper would misread them as a command to
# exec. Use `--entrypoint` to run anything else in the image.
ENTRYPOINT ["node", "/app/packages/agent-bff/dist/cli.js"]
