# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-dummy` is a self-contained, in-memory demo datasource (collections: `books`, `persons`, `libraries`, `librariesBooks`). It exists as a zero-config example/fixture for trying out an agent without a real database, and as a reference implementation of the `@forestadmin/datasource-toolkit` collection contract.

## Architecture

The package exports a single factory, `createDummyDataSource()` from `src/index.ts`. The factory builds a raw `DummyDataSource` and then layers relations on top via a `DataSourceCustomizer` (from `@forestadmin/datasource-customizer`) — relations are NOT defined in the collection schemas, they are added in `index.ts` (`addOneToManyRelation`, `addManyToOneRelation`, `addManyToManyRelation`) and the customizer's `getFactory()` is what callers receive.

- `src/datasource.ts` — `DummyDataSource extends BaseDataSource`; its constructor just instantiates and registers the four collections.
- `src/collections/base.ts` — `BaseDummyCollection extends BaseCollection` holds the real logic. Records live in a plain `RecordData[]` array, and CRUD/aggregate are implemented purely in memory by delegating to the toolkit's query primitives: `filter.conditionTree.apply(...)`, `filter.sort.apply(...)`, `filter.page.apply(...)`, `projection.apply(...)`, and `aggregation.apply(...)`. `aggregate` is implemented on top of `list`. This is the clearest place to see how the toolkit's query objects are meant to be consumed.
- `src/collections/*.ts` — each concrete collection just declares its field schema + seed `records` and calls `super(datasource, name, schema)`.

Two things every collection inherits from the base constructor: a fixed `supportedOperators` set (assigned to every `Column` field, all marked `isSortable`), and a single bulk action `'Mark as Live'` whose `execute()` returns a canned `Success` result.

## Commands

```bash
yarn workspace @forestadmin/datasource-dummy build   # tsc
yarn workspace @forestadmin/datasource-dummy lint
yarn workspace @forestadmin/datasource-dummy test

# single test
yarn workspace @forestadmin/datasource-dummy test -- path/to/file.test.ts
yarn workspace @forestadmin/datasource-dummy test -- -t "name of the test"
```

## Gotchas

- State is in-memory and per-instance: writes mutate the seed arrays and are lost on restart. Treat it as a demo/fixture, not a persistence layer.
- The `books` → `libraries` many-to-many relation field is named `librairies` (French misspelling) in `index.ts`, not `libraries`. Query/wire the books side with `librairies`. The reverse `libraries` → `books` relation is spelled correctly.
- `books` schema has odd column `defaultValue`s (`authorId: 34`, `title: 'Le rouge et le noir'`) with no matching `persons` record for id 34. This is a deliberate fixture quirk — don't "fix" it without checking the tests that rely on it.
- `create` derives new ids by `max(id) + 1` over the in-memory array; ids are not globally unique across reloads.
