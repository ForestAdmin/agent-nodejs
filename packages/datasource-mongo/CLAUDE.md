# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-mongo` connects a raw MongoDB database to a Forest Admin agent. Because MongoDB is schemaless, the package's core job is to **infer a schema by sampling documents**, then build a Mongoose ODM from that inferred schema and delegate all CRUD/query work to the sibling `@forestadmin/datasource-mongoose`.

## Architecture

The public API in `src/index.ts` exposes a pipeline of three stages, each backed by its own module:

1. **Connect** (`connection/create-connection.ts`) — opens a Mongoose connection from a URI + `ConnectOptions`. If `connection.ssh` is set, it first opens an SSH tunnel (`tunnel-ssh`), rewrites the URI to `localhost:<tunnelPort>`, and forces `tlsAllowInvalidHostnames`. The tunnel is torn down on the connection's `close` event.
2. **Introspect** (`introspection/`) — `Introspector.introspect` samples documents to produce an `Introspection` (a serializable JSON schema). `structure.ts` walks sampled documents to build per-field `NodeStudy` trees (which primitive types appear, how often, nested objects/arrays). The two `reference-candidates-*` modules then detect foreign keys: the *finder* picks candidate `ObjectId` fields, the *verifier* queries other collections to confirm the values actually match (`referenceTo`). `Introspector.convert` collapses each `NodeStudy` into a final `ModelAnalysis`.
3. **Build ODM** (`odm-builder/index.ts`) — `OdmBuilder.defineModels` turns each `ModelAnalysis` into a Mongoose `Schema` + model registered on the connection. `createMongoDataSource` wraps the resulting connection in a `MongooseDatasource`, which is what implements the actual datasource-toolkit contract.

So this package contributes **schema inference + connection management**; query execution lives in `datasource-mongoose`, and the field/type contract comes from `@forestadmin/datasource-toolkit`.

The split entry points matter: `createMongoDataSource` is the normal path (introspect-then-build at boot), but an `Introspection` can be precomputed and persisted, then replayed offline via `buildDisconnectedMongooseInstance` (no DB connection) — useful for codegen/typing without hitting the database.

## Commands

```bash
yarn workspace @forestadmin/datasource-mongo build
yarn workspace @forestadmin/datasource-mongo test
yarn workspace @forestadmin/datasource-mongo lint
# single test file or name (positional arg is a regex matched against the full path):
yarn workspace @forestadmin/datasource-mongo test -- introspector
yarn workspace @forestadmin/datasource-mongo test -- test/introspection/introspector.unit
yarn workspace @forestadmin/datasource-mongo test -- -t "detects references"
```

## Gotchas

- **Introspection is versioned.** `Introspector.FORMAT_VERSION` + `SOURCE` are embedded in every `Introspection`. A stored introspection from a newer format throws `IntrospectionFormatError`, and one from a different package source is rejected — bump `FORMAT_VERSION` if you change the `ModelAnalysis` shape.
- **Type collapsing rules** (in `getNodeType`): a field with a single non-null observed type takes that type; mixed types, empty objects, or objects with more than `maxPropertiesPerObject` keys (default 30, assumed dynamic-key maps) become `Mixed`. Models themselves are never collapsed to `Mixed`.
- **Sampling is heuristic.** Defaults are `collectionSampleSize` 100 and `referenceSampleSize` 10. Optional fields rarely present, or references whose sample values don't overlap, can be missed — raise the sample sizes for sparse/large databases. `referenceSampleSize: 0` disables FK detection entirely.
- `_id` is auto-detected as the primary key (and Mongoose's `__v` version key is only kept when present in the sampled docs); don't manually special-case these elsewhere.
