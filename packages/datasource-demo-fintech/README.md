# @forestadmin/datasource-demo-fintech

Demo data source for Forest Admin, themed around a fintech / compliance back
office (customers, cards, KYC, AML alerts, chargebacks…).

On boot it generates a throwaway SQLite database with [faker](https://fakerjs.dev/),
seeds it via [Knex](https://knexjs.org/), and exposes it through
`@forestadmin/datasource-sql`. The schema, column types and primary keys are
introspected from the freshly-created tables. It is used by `forest create demo`
to bootstrap a project with realistic sample data.

```ts
import { createDemoFintechDataSource } from '@forestadmin/datasource-demo-fintech';

agent.addDataSource(createDemoFintechDataSource());
```

## How the data is built

A fresh database is generated on every boot (no fixed seed → the dataset is
re-rolled each time), under the OS temp directory. The seed lives in `src/seed`:

- `seed/index.ts` — orchestrates the builders in dependency order (customers
  first, then everything that references them) and owns the Knex connection.
- one file per domain (`customers`, `cards`, `kyc`, `aml`, `refunds`,
  `chargebacks`) — each creates its table(s) and inserts rows.
- `pools.ts` / `utils.ts` — curated reference data (kept hand-written so
  geography stays internally consistent) and faker-backed random helpers.

Business coherence is enforced in the builders, not by faker: sanctioned
customers never clear onboarding, alerts are weighted by customer risk, a filed
SAR escalates its source alert, chargebacks link back to the right card and
refund request, etc.

Relations, Smart Actions, segments and computed fields are layered on top in
`src/customizations/*`. Dates use the relative `daysAgo(n)` / `dayOnlyAgo(n)`
helpers (see `src/dates.ts`) so the demo always shows recent data.

To rescale the dataset, edit the population sizes in the relevant `src/seed/*`
builder (e.g. `N` in `seed/customers.ts`).
