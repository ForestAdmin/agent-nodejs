# Docker image build assets

The production image installs its runtime dependencies into an **isolated**
`node_modules` (rather than shipping the whole monorepo's hoisted tree). This
keeps the image small while staying reproducible.

## How it works

- [`build-deps-manifest.js`](./build-deps-manifest.js) merges the external
  (non-`@forestadmin`) runtime dependencies of the MCP server and its 4 workspace
  dependencies into a single `package.json`.
- [`deps/yarn.lock`](./deps/) pins every transitive version.
- The Docker build regenerates the manifest from the live `package.json` files
  and runs `yarn install --frozen-lockfile`. If a workspace dependency changes
  in a way the committed lock does not cover, **the build fails** instead of
  silently shipping an unpinned version.
- [`check-deps-closure.js`](./check-deps-closure.js) guards against drift between
  the real `@forestadmin/*` closure of `mcp-server`, `WORKSPACE_PACKAGES`, and the
  Dockerfile's `COPY` lines.
- [`smoke-test.sh`](./smoke-test.sh) boots a built image and asserts it answers
  `/health` (proving the entrypoint and full module graph work).

## Updating the lockfile

Only `deps/yarn.lock` is committed — the manifest is generated on demand (the
Docker build regenerates it too), so there is no stale `package.json` to drift.
Run this whenever a runtime dependency of one of the 5 workspace packages
changes (the build will fail with `--frozen-lockfile` until you do).

The generated manifest carries the repo's pinned `packageManager`
(`yarn@1.22.19`), so with Corepack enabled (`corepack enable`) the refresh uses
the same Yarn as the Docker build — a global Yarn 4 would otherwise emit an
incompatible lockfile format.

```bash
# from the monorepo root (Corepack enabled)
TMP=$(mktemp -d)
node packages/mcp-server/docker/build-deps-manifest.js packages "$TMP/package.json"
( cd "$TMP" && yarn install --ignore-scripts )
cp "$TMP/yarn.lock" packages/mcp-server/docker/deps/yarn.lock
rm -rf "$TMP"
```

Then commit the updated `deps/yarn.lock`.
