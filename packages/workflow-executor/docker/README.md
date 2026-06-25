# Docker image build assets

The production image installs its runtime dependencies into an **isolated**
`node_modules` (rather than shipping the whole monorepo's hoisted tree). This
keeps the image small (~410 MB) while staying reproducible.

## How it works

- [`build-deps-manifest.js`](./build-deps-manifest.js) merges the external
  (non-`@forestadmin`) runtime dependencies of the executor and its 5 workspace
  dependencies, plus the OpenTelemetry packages, into a single `package.json`.
- [`deps/yarn.lock`](./deps/) pins every transitive version.
- The Docker build regenerates the manifest from the live `package.json` files
  and runs `yarn install --frozen-lockfile`. If a workspace dependency changes
  in a way the committed lock does not cover, **the build fails** instead of
  silently shipping an unpinned version.

## Updating the lockfile

Only `deps/yarn.lock` is committed — the manifest is generated on demand (the
Docker build regenerates it too), so there is no stale `package.json` to drift.
Run this whenever a runtime dependency of one of the 6 workspace packages
changes (the build will fail until you do):

```bash
# from the monorepo root
TMP=$(mktemp -d)
node packages/workflow-executor/docker/build-deps-manifest.js packages "$TMP/package.json"
( cd "$TMP" && yarn install --ignore-scripts )
cp "$TMP/yarn.lock" packages/workflow-executor/docker/deps/yarn.lock
rm -rf "$TMP"
```

Then commit the updated `deps/yarn.lock`.
