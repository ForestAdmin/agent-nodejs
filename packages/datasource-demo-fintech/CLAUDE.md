# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Demo data source themed around a fintech / compliance back office (customers, cards, KYC, AML alerts, chargebacks, refunds, SAR reports). It is consumed by `forest create demo` to bootstrap a project with realistic sample data. The single export is `createDemoFintechDataSource(): DataSourceFactory`.

## Architecture

There is no static DB file. `src/index.ts` builds the whole thing at boot in three layers, and the order matters:

1. **Seed → SQLite** (`src/seed/`): `seed(filename)` opens one Knex connection and runs the domain builders in dependency order — `customers` first, then everything that references them (`cards`, `refunds`, `kyc`, `aml`, `chargebacks`). Each builder both `createTable`s and inserts rows; relations resolve because of that ordering. Business coherence (sanctioned customers never onboard, alerts weighted by risk, a filed SAR escalates its source alert) is enforced in the builders, **not** by faker.
2. **Introspect** via `@forestadmin/datasource-sql` (`createSqlDataSource`): schema, column types and primary keys come from the freshly-created tables, not from hand-written definitions.
3. **Customize** (`src/customizations/`): one module per collection wires relationships, computed fields, segments and Smart Actions on top, all centred on `customers`. Built with `DataSourceCustomizer` from `@forestadmin/datasource-customizer`.

Reference data lives in `src/seed/pools.ts` (curated geography + the categorical enum domains, treated as the single source of truth). Random helpers are in `src/seed/utils.ts`. Dates are always relative via `src/seed/dates.ts` (`daysAgo` / `dayOnlyAgo` / `hoursAgo`) so the demo always shows recent data.

## Commands

- Build: `yarn workspace @forestadmin/datasource-demo-fintech build`
- Test: `yarn workspace @forestadmin/datasource-demo-fintech test`
- Lint: `yarn workspace @forestadmin/datasource-demo-fintech lint`
- Single test: `yarn workspace @forestadmin/datasource-demo-fintech test -- -t "rebuild a fresh database"`

## Gotchas

- **A new database is re-rolled on every boot** — no fixed faker seed, so the dataset differs each run. `index.ts` does `rm('db.sqlite', { force: true })` before seeding; the second-boot test exists to guarantee `createTable` never fails on a leftover file. Don't write tests that assume specific seeded values.
- **Enums are restored manually.** SQLite stores categorical columns as text, so introspection types them as `String`. `applyEnums` in `index.ts` re-types them to `Enum` (restoring Forest dropdowns) using the pools' enum lists. When a Smart Action writes a value the seed never inserts (e.g. `SAR_FILED` on `aml_alerts`, `DISMISSED` on `chargebacks`), that value must be added to the `ENUM_FIELDS` list in `index.ts` or re-typing will reject it.
- **`sar_reports` is seeded inside `seed/aml.ts`**, not a file of its own — but it has its own `customizations/sar_reports.ts`.
- To rescale the dataset, edit the population constant (e.g. `N` in `seed/customers.ts`); downstream tables derive their sizes from the customer base.
