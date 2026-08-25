# Docker image build assets

The production image installs its runtime dependencies into an **isolated**
`node_modules` (rather than shipping the whole monorepo's hoisted tree). This
keeps the image small while staying reproducible.

## How it works

- [`build-deps-manifest.js`](./build-deps-manifest.js) merges the external
  (non-`@forestadmin`) runtime dependencies of the BFF and its 4 workspace
  dependencies, plus the OpenTelemetry packages, into a single `package.json`.
- [`deps/yarn.lock`](./deps/) pins every transitive version.
- The Docker build regenerates the manifest from the live `package.json` files
  and runs `yarn install --frozen-lockfile`. If a workspace dependency changes
  in a way the committed lock does not cover, **the build fails** instead of
  silently shipping an unpinned version.
- [`check-deps-closure.js`](./check-deps-closure.js) recomputes the real
  transitive `@forestadmin` closure of the BFF and fails when the hardcoded list
  or the Dockerfile `COPY` lines drift from it.
- [`smoke-test.sh`](./smoke-test.sh) runs a locally-loaded image before it is
  published: CLI surface, module graph, Redoc bundle, boot and `/health`.

## Running the smoke test

```bash
sh packages/agent-bff/docker/smoke-test.sh <image-ref>
```

It needs `docker`, `curl`, `openssl` and **`python3`** on the host. The last one
serves a two-line stub of the Forest server so the second boot can be fully
configured and reach `/health` 200 — the path the image's own HEALTHCHECK
demands, which nothing else exercises. All four are present on the GitHub
runners; on a slim box python3 is the one likely to be missing.

## Updating the lockfile

Only `deps/yarn.lock` is committed — the manifest is generated on demand (the
Docker build regenerates it too), so there is no stale `package.json` to drift.
Run this whenever a runtime dependency of one of the 5 workspace packages
changes **or when the `OTEL_DEPENDENCIES` versions in `build-deps-manifest.js`
are bumped** (the build will fail with `--frozen-lockfile` until you do):

The generated manifest carries the repo's pinned `packageManager`
(`yarn@1.22.19`), so with Corepack enabled (`corepack enable`) the refresh uses
the same Yarn as the Docker build — a global Yarn 4 would otherwise emit an
incompatible lockfile format.

```bash
# from the monorepo root (Corepack enabled)
TMP=$(mktemp -d)
node packages/agent-bff/docker/build-deps-manifest.js packages "$TMP/package.json"
( cd "$TMP" && yarn install --ignore-scripts )
cp "$TMP/yarn.lock" packages/agent-bff/docker/deps/yarn.lock
rm -rf "$TMP"
```

Then commit the updated `deps/yarn.lock`.
