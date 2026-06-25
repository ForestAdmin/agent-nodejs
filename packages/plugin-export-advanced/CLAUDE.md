# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/plugin-export-advanced` is an agent plugin that adds a Global "Export … (advanced)" action to a collection (or to every collection of a datasource). Unlike Forest's built-in CSV export, it lets the admin pick the output format (CSV / XLSX / JSON), the filename, and the exact set of fields — including fields reached through relations.

## Architecture

The whole plugin is one exported function, `addExportAdvanced(dataSource, collection, options?)` in `src/index.ts`, written to be passed to `.use()` / `.customizeCollection(...).use()` of `@forestadmin/datasource-customizer` (a sibling package; `datasource-toolkit` provides the underlying schema/record types). If `collection` is null it loops over `dataSource.collections` and registers one action per collection.

Two abstractions to understand before editing:

- **Projection strings.** `getFields()` walks the collection schema and produces a flat list of field paths. `Column` fields become their own name; `ManyToOne`/`OneToOne` relations are recursively expanded with a colon separator (`author:name`), capped at depth 2. This colon-delimited path is the contract used everywhere downstream: the action's `Fields` form is populated from it, `collection.list(filter, fields)` is called with it, and `src/utils/get-field-value.ts` resolves it against each returned record by splitting on `:` and walking nested objects.

- **Renderers.** `src/renderers/index.ts` is a registry keyed by file extension (`.csv`, `.xlsx`, `.json`), each entry `{ handler, mimeType }`. The `Format` enum in the form is literally `Object.keys(renderers)`, and the action passes the chosen records + projection to `renderer.handler` then returns `resultBuilder.file(output, filename + format, mimeType)`. Adding a format = adding one entry here; the form and execute path pick it up automatically. Note the registry keys ARE the extensions (with leading dot), so the filename is built as `${filename}${format}`.

## Commands

```bash
yarn workspace @forestadmin/plugin-export-advanced build
yarn workspace @forestadmin/plugin-export-advanced test
yarn workspace @forestadmin/plugin-export-advanced lint

# single test
yarn workspace @forestadmin/plugin-export-advanced test -- -t "name of the test"
```

## Gotchas

- The `Fields` form field uses a `value:` change-hook callback instead of `defaultValue:` (see the `@fixme` comment) to work around a frontend bug — keep the workaround until that bug is fixed.
- Relation expansion only follows `ManyToOne`/`OneToOne` and stops at depth 2; `OneToMany`/`ManyToMany` are intentionally not exported.
- `excel4node` is the only runtime dependency; the XLSX renderer infers a cell type (bool/number/date/string) from each value's runtime shape, so a column with mixed-looking strings (e.g. numeric-looking text) may be coerced — check `getExcel4NodeTypeFromValue` before changing cast logic.
- The CSV escaper only quotes values containing a comma and uses `String.replace` (first match only, not global) — be aware of its limits if touching escaping.
