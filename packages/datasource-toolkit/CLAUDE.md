# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-toolkit` is the foundational, dependency-free contract layer of the monorepo. It defines the `DataSource` / `Collection` interfaces every concrete datasource implements (`datasource-sql`, `datasource-mongo`, `datasource-sequelize`, `datasource-mongoose`, ...), the query language those collections speak, and the decorator base classes that `datasource-customizer`, `agent`, and the plugins extend. Almost every other package depends on it; it depends on no other `@forestadmin/*` package except `agent-toolkit`.

## Architecture

The whole package orbits two interfaces in `src/interfaces/collection.ts`:

- A `DataSource` is a bag of named `Collection`s plus chart/native-query entry points.
- A `Collection` exposes a CRUD + `aggregate` + action surface (`list`, `create`, `update`, `delete`, `aggregate`, `execute`, `getForm`, `renderChart`) and a `schema` (`src/interfaces/schema.ts`) describing its fields (`ColumnSchema` vs the relation schemas `ManyToOne`/`OneToMany`/`OneToOne`/`ManyToMany`).

Every query method takes the same building blocks, defined under `src/interfaces/query/` and validated under `src/validation/`:

- **ConditionTree** (`condition-tree/nodes/`): `Branch` (and/or) + `Leaf` (`{ field, operator, value }`). The abstract base (`nodes/base.ts`) is where the reusable algebra lives — `inverse`, `replaceLeafs(Async)`, `nest`/`unnest` (relation prefixes joined by `:`), `match`/`apply` for in-memory filtering. Decorators rewrite filters by transforming these trees, so understand `replaceLeafs` before touching filter logic.
- **Projection** (a `string[]` subclass, relations as `author:name`), **Sort**, **Page**, **Filter**/`PaginatedFilter`, **Aggregation**. Each has a sibling `*Factory` (e.g. `ConditionTreeFactory`, `FilterFactory`) for building/combining instances — prefer the factory over hand-constructing.

**Decorators are the extension mechanism.** `DataSourceDecorator` wraps a child datasource and lazily wraps each child collection in a `CollectionDecorator` subclass (one `WeakMap`-cached instance per child). `CollectionDecorator` (`src/decorators/collection-decorator.ts`) delegates every method to `childCollection` after passing the filter through `refineFilter`, and overrides `refineSchema` to transform the schema. Subclasses override only these two hooks. Schema is cached in `lastSchema` and invalidated via `markSchemaAsDirty`, which propagates **upward** through the decorator stack (a parent patches its child's `markSchemaAsDirty` in the constructor, since children hold no parent reference). The customization layer in `datasource-customizer` is a tower of such decorators.

`BaseCollection` / `BaseDataSource` are abstract starting points for hand-written datasources; concrete SQL/Mongo datasources usually don't extend them.

## Commands

```bash
yarn workspace @forestadmin/datasource-toolkit build   # tsc
yarn workspace @forestadmin/datasource-toolkit lint
yarn workspace @forestadmin/datasource-toolkit test
# single test file or by name:
yarn workspace @forestadmin/datasource-toolkit test -- test/interfaces/query/condition-tree/nodes/branch.test.ts
yarn workspace @forestadmin/datasource-toolkit test -- -t "replaceLeafs"
```

## Gotchas

- Tests live in a separate top-level `test/` tree mirroring `src/` (not co-located); jest `testMatch` only picks up `test/**/*.test.ts`.
- This package is the public barrel: most exports flow through `src/index.ts`. Some internals import from `./index` (e.g. `BaseCollection` pulls `SchemaUtils` from the barrel), so be wary of import ordering / circular-reference surprises when adding exports.
- `src/factory.ts` defines runtime *types* `DataSourceFactory` and `Logger`/`LoggerLevel` — not query factories. The query/condition-tree factories are the separate `*Factory` classes under `src/interfaces/query/`.
- Field paths use `:` as the relation separator throughout (projections, condition-tree leaf fields, `nest`/`unnest`). Keep this convention when manipulating fields.
