# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Demo data source themed around a bank's back office (KYC, screening, AML, SARs, chargebacks, SEPA disputes, transfers, e-invoicing, credit). It is consumed by `forest start` (demo) together with the CLI's demo layout: the demo layout and its Custom components ship with the Forest CLI. The single export is `createDemoBankDataSource(): DataSourceFactory`. Written in TypeScript, lightly typed (the repo's tsconfig is not strict); `tsc` emits `dist/` and its `.d.ts`.

## Architecture

`src/index.js` builds everything at boot; the order matters:

1. **Seed → SQLite** (`src/seed/`): `seed(filename)` creates every table from `src/model/data-model.json`, then runs the domain builders. Then `addShowcaseCases` adds the KYC case desk's four cases (`KYC-DEMO-000x`).
2. **Introspect** via `@forestadmin/datasource-sql`; `applyTypes` re-types SQLite text columns as `Enum` (from `data-model.json`) and `Uuid`.
3. **Customize**: `addLinks`, `addReadableNames`, `addParentLists` (`customizations/shared/`) for every table, then `customizeCollection(<table>, …)` per table (`customizations/<table>.js`), then `addCharts` (`charts/index.js`).

## Commands

- Build: `yarn workspace @forestadmin/datasource-demo-bank build` (tsc, then `scripts/copy-assets.js` for `data-model.json`)
- Test: `yarn workspace @forestadmin/datasource-demo-bank test`
- Lint: `yarn workspace @forestadmin/datasource-demo-bank lint`

## Gotchas

- **Smart Action order is a contract.** The agent numbers action endpoints by declaration order per collection (`/forest/_actions/<collection>/<index>/<slug>`) and the CLI's demo layout calls those numbers. Adding, removing or reordering an action, a collection or a chart means regenerating the CLI's `forest-layout.json`.
- **Chart answers and segment keys are a contract** too: the CLI's Custom components read the API charts (`hub_counts` answers per segment key of `customizations/shared/segments.js`; the Hub adds up each desk's queues).
- **The data is deterministic** (fixed seed, dates relative to today, the hour as the story's end): a test may rely on counts, not on today's dates.
