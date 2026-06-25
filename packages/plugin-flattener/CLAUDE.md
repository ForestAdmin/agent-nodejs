# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/plugin-flattener` is a customization plugin: it exposes nested data (composite/JSON columns and related collections) as flat, top-level fields on a collection. Plugins are functions passed to `collection.use(...)` from `@forestadmin/datasource-customizer`; this package depends on `@forestadmin/datasource-toolkit` (`SchemaUtils`, `ConditionTreeFactory`) to read schemas and build filters.

## Architecture

Three plugin entry points are re-exported from `src/index.ts`, each a function `(dataSource, collection, options) => ...`:

- **`flattenColumn`** — flattens a composite (non-JSON) column. Resolves which nested paths to expose (`optionsToPaths`), then `collection.addField` for each, with `getValues` reading the deep value at read time.
- **`flattenJsonColumn`** — thin wrapper over `flattenColumn` for `Json` columns: requires an explicit `columnType` shape (you describe the JSON's structure), defaults `level` to the depth of that shape, and `removeField`s the original column unless `keepOriginalColumn` is set.
- **`flattenRelation`** — imports a ManyToOne/OneToOne relation's columns via `collection.importField`. `getRelation` walks `:`-separated relation chains recursively.

**Path encoding is the central convention.** Nested addresses use `@@@` as the internal separator for generated field names (e.g. `address@@@streetName`), while user-facing `include`/`exclude` options accept `.` or `:` and are normalized via `includeStrToPath`. `flattenRelation` uses `:` in paths but aliases the field name with `@@@`. The `src/flatten-column/helpers.ts` functions (`listPaths`, `getValue`, `unflattenPathsInPlace`, `deepUpdateInPlace`) are the round-trip between flat field names and the nested object shape.

**Write path is non-obvious** (`src/flatten-column/customization.ts`): writes are *not* handled by per-field write handlers. Instead `flattenColumn` registers `Before`/`Create` and `Before`/`Update` hooks that `unflattenPathsInPlace` the incoming patch back into the original nested column. `replaceFieldWriting` handlers are registered only to flag fields as writable — they throw if ever called. On update, when patching the nested column itself, the hook re-reads matching records, groups them by resulting patch (hashed with `object-hash`), and may split into multiple `update` calls when records diverge.

## Commands

```bash
yarn workspace @forestadmin/plugin-flattener build   # tsc
yarn workspace @forestadmin/plugin-flattener test    # jest
yarn workspace @forestadmin/plugin-flattener lint

# single test file / by name
yarn workspace @forestadmin/plugin-flattener test -- flatten-column
yarn workspace @forestadmin/plugin-flattener test -- -t "flattens a json column"
```

## Gotchas

- `flattenColumn` rejects `Json` columns (directs you to `flattenJsonColumn`), array column types, and primitive types — it only flattens composite shapes whose structure is known from the schema or passed `columnType`.
- `flattenJsonColumn` requires `columnType` because JSON has no schema; it errors on non-`Json` columns and on an empty `columnType`.
- Fields become read-only automatically if the source column `isReadOnly`, or if `readonly: true` is passed; only then are the write hooks skipped.
