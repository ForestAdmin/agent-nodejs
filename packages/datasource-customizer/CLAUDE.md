# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/datasource-customizer` is the customization layer of the agent. It wraps any raw `DataSource` produced by a sibling datasource package (`datasource-sql`, `datasource-mongoose`, ...) and lets users add computed fields, relations, actions, segments, charts, hooks, validation, search, write handlers, etc. — without touching the underlying source. It is what the `agent` package exposes as `agent.customizeCollection(...)`.

## Architecture

The whole package is a **decorator stack**. The public API is two builder classes:

- `DataSourceCustomizer` (`src/datasource-customizer.ts`) — datasource-level: `addDataSource`, `removeCollection`, `addChart`, `use` (plugins), `customizeCollection`.
- `CollectionCustomizer` (`src/collection-customizer.ts`) — collection-level fluent API (`addField`, `addRelation`, `addAction`, `replaceSearch`, `emulateFieldOperator`, ...).

Key things only visible after reading several files:

- **Lazy / queued customizations.** Builder methods do **not** mutate anything immediately — they push a closure onto `DecoratorsStackBase.customizations` (via `stack.queueCustomization` / `CollectionCustomizer.pushCustomization`). Nothing runs until `getDataSource(logger)` calls `applyQueuedCustomizations`, which builds the stack and drains the queue. Plugins may queue further customizations; the queue is drained recursively so order stays correct.
- **The stack is an ordered chain of `DataSourceDecorator`s** assembled in `src/decorators/decorators-stack.ts#buildStack`. **Order is load-bearing and commented** — e.g. the computed→relation→computed "sandwich" (emulated relations can depend on computed fields and vice-versa), operator-equivalence/emulation layers, and renaming kept first-or-last so customer code sees consistent names. Do not reorder layers without understanding the comments.
- Each `src/decorators/<feature>/` folder is one layer, typically a `collection.ts` (extends a toolkit `CollectionDecorator`) plus a `datasource.ts` and `types.ts`. The stack exposes named handles (`this.computed`, `this.action`, ...) so builder methods reach the right layer.
- **`DecoratorsStackNoCode`** (`decorators-stack-no-code.ts`) is an alternate `buildStack` selected via the `{ strategy: 'NoCode' }` option for the no-code product.
- **`backupStack`/`restoreStack`** exist so a hot-reload (agent restart with new config) can roll back to the previous working stack if the new customizations throw.
- **Typing system:** `src/templates.ts` defines the generic `TSchema`/`TCollectionName`/`TFieldName` machinery that gives end users typed field/collection names; `src/typing-generator.ts` (`updateTypesOnFileSystem`) generates the `.d.ts` users import for that typing.

## Commands

```bash
yarn workspace @forestadmin/datasource-customizer build
yarn workspace @forestadmin/datasource-customizer test
yarn workspace @forestadmin/datasource-customizer lint

# single test file / test name
yarn workspace @forestadmin/datasource-customizer test -- test/decorators/computed/collection.test.ts
yarn workspace @forestadmin/datasource-customizer test -- -t "computed"
```

## Gotchas

- This package builds **on top of `@forestadmin/datasource-toolkit`** (pinned dep): `DataSourceDecorator`, `CollectionDecorator`, `ConditionTree`, schema/utils all come from there. Add a new layer by subclassing the toolkit decorators, not by re-implementing query logic.
- The **search decorator uses an ANTLR4 grammar**. `src/decorators/search/Query.g4` is the source of truth; `src/decorators/search/generated-parser/` is generated output (do not hand-edit). Regenerate with `yarn workspace @forestadmin/datasource-customizer build:parser` (requires the `antlr4` CLI). `build` does not regenerate it.
- Builder methods return `this` for chaining but their effect is deferred — a test that asserts on `customizeCollection(...)` results must go through `getDataSource(logger)` first.
