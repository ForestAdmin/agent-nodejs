# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Demo data source themed around a bank's back office (KYC, screening, AML, SARs, chargebacks, SEPA disputes, transfers, e-invoicing, credit). It is consumed by `forest start` (demo) together with the CLI's demo layout. The single export is `createDemoBankDataSource(): DataSourceFactory`. Written in JavaScript (`allowJs`); `tsc` emits `dist/` and its `.d.ts`.

## Architecture

`src/index.js` builds everything at boot; the order matters:

1. **Seed → SQLite** (`src/seed/`): `seed(filename)` creates every table from `src/model/schema.json`, then runs the domain builders. Then `addShowcaseCases` adds the KYC case desk's four cases (`KYC-DEMO-000x`).
2. **Introspect** via `@forestadmin/datasource-sql`; `applyTypes` re-types SQLite text columns as `Enum` (from `schema.json`) and `Uuid`.
3. **Customize**: `addLinks`, `addReadableNames`, `addParentLists` (`customizations/shared/`) for every table, then `customizeCollection(<table>, …)` per table (`customizations/<table>.js`), then `addCharts` (`charts/index.js`).

`src/components/` holds browser files (Glimmer templates, components, CSS): they are excluded from `tsc` and only read by `scripts/build-public.js`, which renders them into `dist/public/hub/`.

## Commands

- Build: `yarn workspace @forestadmin/datasource-demo-bank build` (tsc, `scripts/copy-assets.js` for the model JSON, `scripts/build-public.js` for the components)
- Test: `yarn workspace @forestadmin/datasource-demo-bank test`
- Lint: `yarn workspace @forestadmin/datasource-demo-bank lint`

## Gotchas

- **Smart Action order is a contract.** The agent numbers action endpoints by declaration order per collection (`/forest/_actions/<collection>/<index>/<slug>`) and the CLI's demo layout calls those numbers. Adding, removing or reordering an action, a collection or a chart means regenerating the CLI's `forest-layout.json`.
- **The data is deterministic** (fixed seed, dates relative to today, the hour as the story's end): a test may rely on counts, not on today's dates.
- **Component file names are a contract** too: the layout loads them by name from `dist/public/hub/`. `publicFiles()` in `scripts/build-public.js` is the list; the major version in the CDN URL is pinned by the CLI.
