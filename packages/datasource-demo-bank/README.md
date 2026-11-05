# @forestadmin/datasource-demo-bank

Demo data source for Forest Admin, themed around a retail and business bank's back office:
onboarding and KYC, sanctions screening, AML alerts and investigations, SAR reports, card
chargebacks, SEPA disputes, outgoing transfers, e-invoicing, credit and the account lifecycle.

On boot it builds a throwaway SQLite database (`db.sqlite` in the current folder), seeds it via
[Knex](https://knexjs.org/) and exposes it through `@forestadmin/datasource-sql`. It is used by
`forest start` (demo) to bootstrap a project with realistic sample data, work queues, Smart
Actions and API charts.

```ts
import { createDemoBankDataSource } from '@forestadmin/datasource-demo-bank';

agent.addDataSource(createDemoBankDataSource());

// Or with the partner portal at another address:
agent.addDataSource(
  createDemoBankDataSource({ partnerPortalOrigins: ['https://portal.example.com'] }),
);
```

A few Smart Actions are demo tools: Send new applications, Start the day, Reset the demo cases.

## How the data is built

- **Seed** (`src/seed/`): `seed/data-model.ts` lists the 59 tables, their fields, enums and links
  (`seed/schema.ts` reads it and names the links); `seed/index.ts` creates every table and runs
  the domain builders (retail, business, banking, crime, disputes, e-invoicing, credit,
  lifecycle…), then adds the four demo KYC cases (`KYC-DEMO-000x`). The stories are
  the same on every boot (fixed seed in `seed/random.ts`) and dated from the boot, so a demo never
  looks stale; two boots within the same hour give exactly the same rows. Business coherence is enforced in the builders: a filed SAR escalates its alert, a
  chargeback links back to its card transaction, and so on.
- **Customize** (`src/customizations/`): the links of the data model, readable record names and
  parent lists for every table (`shared/`), then one module per table with its Smart Actions,
  computed fields and evidence. `shared/segments.ts` defines the work queues: per key, a table, a
  name and the filter that selects the records waiting in it.
- **Charts** (`src/charts/`): the API charts: each team's weekly figures, the tasks waiting in
  every queue (`hub_counts`), the data model by domain (`data_map`), a few headline figures
  (`feature_facts`) and how far the demo's KYC story has gone (`demo_guide`).

## Partner portal

The `Submit application` and `Upload document` Smart Actions take applications and files from a
partner portal. `Upload document` fetches a file only from the portal addresses given in the
`partnerPortalOrigins` option (default `['http://localhost:3500', 'http://127.0.0.1:3500']`): a
PDF, PNG or JPEG of at most 5 MB, no redirect. An uploaded paper waits for its check like the
others; an uploaded ID has no flaw.
