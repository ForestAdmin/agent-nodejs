# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Demo data source themed around a fintech / compliance back office (customers, cards, KYC, AML alerts, chargebacks, refunds, SAR reports). It is consumed by `forest create demo` to bootstrap a project with realistic sample data. The single export is `createDemoFintechDataSource(): DataSourceFactory`.

## Architecture

There is no static DB file. `src/index.ts` builds the whole thing at boot in three layers, and the order matters:

1. **Seed → SQLite** (`src/seed/`): `seed(filename)` opens one Knex connection and runs the domain builders in dependency order — `customers` first, then everything that references them (`cards`, `refunds`, `kyc`, `aml`, `chargebacks`). Each builder both `createTable`s and inserts rows; relations resolve because of that ordering. Business coherence (sanctioned customers never onboard, alerts weighted by risk, a filed SAR escalates its source alert) is enforced in the builders, **not** by faker.
2. **Introspect** via `@forestadmin/datasource-sql` (`createSqlDataSource`): schema, column types and primary keys come from the freshly-created tables, not from hand-written definitions.
3. **Customize** (`src/customizations/`): one module per collection, built with `DataSourceCustomizer` from `@forestadmin/datasource-customizer`. Relationships are everywhere (all centred on `customers`). Smart Actions are on most modules, but **not uniform**: `customers.ts` has relationships only; computed fields (`addField`) and segments (`addSegment`) live **only** in `chargebacks.ts` (`days_to_deadline`, `is_overdue`; segments Open / Overdue / Awaiting evidence / Pre-arbitration & Arbitration). Don't assume other modules have fields or segments.

Reference data lives in `src/seed/pools.ts` (curated geography + the categorical enum domains, treated as the single source of truth). Random helpers are in `src/seed/utils.ts`. Dates are always relative via `src/seed/dates.ts` (`daysAgo` / `dayOnlyAgo` / `hoursAgo`) so the demo always shows recent data.

## Commands

- Build: `yarn workspace @forestadmin/datasource-demo-fintech build`
- Test: `yarn workspace @forestadmin/datasource-demo-fintech test`
- Lint: `yarn workspace @forestadmin/datasource-demo-fintech lint`
- Single test: `yarn workspace @forestadmin/datasource-demo-fintech test -- -t "rebuild a fresh database"`

## Gotchas

- **A new database is re-rolled on every boot** — no fixed faker seed, so the dataset differs each run. `index.ts` does `rm('db.sqlite', { force: true })` before seeding; the second-boot test exists to guarantee `createTable` never fails on a leftover file. Don't write tests that assume specific seeded values.
- **Enums are restored manually.** SQLite stores categorical columns as text, so introspection types them as `String`. `applyEnums` in `index.ts` re-types them to `Enum` (restoring Forest dropdowns), building each value set from the pool lists in `seed/pools.ts`. `ENUM_FIELDS` in `index.ts` appends any value **absent from that pool list** — e.g. `[...AML_STATUSES, 'SAR_FILED']` because `AML_STATUSES` (pools.ts) is only OPEN/IN_REVIEW/CLEARED/ESCALATED, and `[...CB_STATUS, 'DISMISSED']` because no `CB_STATUS` value is `DISMISSED`. Re-typing rejects any column value missing from its declared set. (Note: the seed **does** write `SAR_FILED` — `seed/aml.ts` sets it on escalated alerts and inserts them; the comment in `pools.ts` claiming the seed never emits it is wrong. The relevant fact is the pool list, not the seed.)
- **Collection ≠ its own seed file (two cases).** `sar_reports` is created+seeded inside `seed/aml.ts` and `kyc_documents` inside `seed/kyc.ts` — yet each still has its own `customizations/*.ts`. The 1:1 "one seed file per collection" assumption breaks for both.
- To rescale the dataset, edit the population constant (e.g. `N` in `seed/customers.ts`); downstream tables derive their sizes from the customer base.
