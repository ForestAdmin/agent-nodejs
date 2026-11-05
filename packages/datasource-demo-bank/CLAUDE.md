# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Demo data source themed around a bank's back office (KYC, screening, AML, SARs, chargebacks, SEPA disputes, transfers, e-invoicing, credit). It is consumed by `forest start` (demo); the demo layout (workspaces, inboxes, workflows, Custom components) ships with the Forest CLI. This package holds data, work queues, Smart Actions and API charts only. The exports are `createDemoBankDataSource(options?: DemoBankOptions): DataSourceFactory` and the `DemoBankOptions` type (`partnerPortalOrigins`: the addresses "Upload document" fetches files from, default `http://localhost:3500` and `http://127.0.0.1:3500`; threaded to `customizations/shared/uploads.ts` through `customizeKycCases`, no environment variable). Written in TypeScript, lightly typed (the repo's tsconfig is not strict); `tsc` emits `dist/` and its `.d.ts`.

## Architecture

`src/index.ts` builds everything at boot; the order matters:

1. **Seed → SQLite** (`src/seed/`): `seed(filename)` creates every table from `src/seed/data-model.ts` (read through `src/seed/schema.ts`), runs the domain builders, then `addShowcaseCases` (`customizations/actions/showcase.ts`, passed to `seed` by `src/index.ts`) adds the demo's four KYC cases (`KYC-DEMO-000x`) to the rows before they are written.
2. **Introspect** via `@forestadmin/datasource-sql`; `applyTypes` re-types SQLite text columns as `Enum` (from `data-model.ts`) and `Uuid`.
3. **Customize**: `addLinks`, `addReadableNames`, `addParentLists` (`customizations/shared/`) for every table, then `customizeCollection(<table>, …)` per table (`customizations/<table>.ts`), then `addCharts` (`charts/index.ts`). The work queues (`customizations/shared/segments.ts`: table, name, filter per key) are counted by the `hub_counts` and `feature_facts` charts.

## Commands

- Build: `yarn workspace @forestadmin/datasource-demo-bank build` (`tsc`)
- Test: `yarn workspace @forestadmin/datasource-demo-bank test`
- Lint: `yarn workspace @forestadmin/datasource-demo-bank lint`

## Gotchas

- **Smart Action order is a contract.** The agent numbers action endpoints by declaration order per collection (`/forest/_actions/<collection>/<index>/<slug>`) and the CLI's demo layout calls those numbers. Adding, removing or reordering an action, a collection or a chart means regenerating the CLI's `forest-layout.json`.
- **Chart names, chart answers and queue keys are a contract** too: the CLI's Custom components read the API charts by name (`hub_counts` answers per queue key of `customizations/shared/segments.ts`), and the demo layout's segments repeat each queue's filter (one level deep). Its workflow steps call Smart Actions by name and read the evidence fields by name. This is the only place the package describes the CLI side; code comments describe the data and behaviour only.
- **The data is deterministic** (fixed seed, dates relative to today, the hour as the story's end): a test may rely on counts, not on today's dates.
