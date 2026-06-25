# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-mongoose` exposes existing Mongoose models to a Forest Admin agent. `createMongooseDataSource(connection, options)` returns a `DataSourceFactory`; it reads `connection.models` and turns each Mongoose model into a `MongooseCollection` built on `@forestadmin/datasource-toolkit`'s `BaseCollection`/`BaseDataSource`. Sibling `datasource-mongo` does the same for the raw MongoDB driver; this one requires a Mongoose connection and its schemas.

## Architecture

The hard part is bridging Mongoose's nested/array/subdocument documents to Forest Admin's flat relational model. Three abstractions cooperate:

- **`MongooseSchema`** (`src/mongoose/schema.ts`) — normalizes a Mongoose schema into a recursive tree of `SchemaType`/branch nodes (`buildFields`), hiding nested schemas, document arrays, and `[]` array markers. `getSubSchema(path)` walks paths (including `__manyToOne` synthetic relations). `applyStack(stack)` is the inverse: it projects the tree down a `Stack` to compute the schema of a virtual sub-collection, injecting synthetic `_id`/`parent`/`parentId` fields.
- **Flattening** (`src/utils/options.ts` + `datasource.ts`) — `MongooseOptions.flattenMode` (`auto` | `manual` | `none` | legacy default) decides how nested structures are surfaced. `asModels` promotes a nested object/array into its **own virtual collection** (linked back by `parentId`); `asFields` flattens a nested leaf up to the parent collection's root. `OptionsParser` resolves these per model, then `MongooseDatasource.addModel` recurses, building one collection per `Stack` (a list of `{ prefix, asFields, asModels }` steps) and adding implicit one-to-many / one-to-one / many-to-many relations via `RelationGenerator`.
- **Aggregation pipeline** (`src/utils/pipeline/*`) — every read in `MongooseCollection` (`list`, `aggregate`) compiles the toolkit's `Filter`/`Projection`/`Aggregation` into a single MongoDB `$aggregate` pipeline. `buildBasePipeline` orders the stages: reparent (descend into the sub-collection) → virtual fields → lookups → filter → sort/paginate. Lookups are split into "used in filters" (before filtering) vs. not, for performance, and `FilterAtStage` decides where sort/limit slots in. Writes (`create`/`update`/`delete`) on root collections delegate to Mongoose; on virtual sub-collections they translate to `$set`/`$push`/`$unset`/`$pull` on the parent document via the synthetic `parentId` (reparenting is forbidden).

## Commands

```bash
yarn workspace @forestadmin/datasource-mongoose build
yarn workspace @forestadmin/datasource-mongoose test
yarn workspace @forestadmin/datasource-mongoose lint

# single test file / by name
yarn workspace @forestadmin/datasource-mongoose test -- test/utils/options.integration.test.ts
yarn workspace @forestadmin/datasource-mongoose test -- -t "auto flatten"
```

## Gotchas

- **Integration tests need a live MongoDB.** `test/integration/**` connect to `mongodb://root:password@localhost:27019`. Start it with `docker-compose up -d` from this package dir (the compose file maps Mongo to host port **27019**, not the default 27017).
- **Mongoose is a peer dependency** (`6.x || 7.x || 8.x`). Version differences in how subdocuments/arrays are represented are isolated in `src/utils/version-manager.ts` — handle cross-version schema detection there, not inline.
- A missing `flattenMode` falls back to legacy behavior and logs a warning; new code/tests should pass an explicit mode.
- In paths, `:` is accepted as a separator and normalized to `.` (option parsing), and flattened field names are stored internally with `.` replaced by `@@@` (see `applyStack`); don't assume field keys are plain dotted paths.
