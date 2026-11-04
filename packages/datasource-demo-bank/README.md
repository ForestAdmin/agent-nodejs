# @forestadmin/datasource-demo-bank

Demo data source for Forest Admin, themed around a retail and business bank's back office:
onboarding and KYC, sanctions screening, AML alerts and investigations, SAR reports, card
chargebacks, SEPA disputes, outgoing transfers, e-invoicing, credit and the account lifecycle.

On boot it builds a throwaway SQLite database (`db.sqlite` in the current folder), seeds it via
[Knex](https://knexjs.org/) and exposes it through `@forestadmin/datasource-sql`. It is used by
`forest start` (demo) to bootstrap a project with realistic sample data, Smart Actions and the
charts its workspaces read.

```ts
import { createDemoBankDataSource } from '@forestadmin/datasource-demo-bank';

agent.addDataSource(createDemoBankDataSource());
```

## How the data is built

- **Model** (`src/model/`): `data-model.json` lists the 59 tables, their fields, enums and links.
- **Seed** (`src/seed/`): `seed/index.ts` creates every table and runs the domain builders
  (retail, business, banking, crime, disputes, e-invoicing, credit, lifecycle…). The stories are
  the same on every boot (fixed seed in `seed/random.ts`) and dated from the boot, so a demo never
  looks stale; two boots within the same hour give exactly the same rows. Business coherence is enforced in the builders: a filed SAR escalates its alert, a
  chargeback links back to its card transaction, and so on.
- **Customize** (`src/customizations/`): the links of the data model, readable record names and
  parent lists for every table (`shared/`), then one module per table with its Smart Actions,
  computed fields and evidence.
- **Charts** (`src/charts/`): the API charts the demo workspaces read (the desks' weekly figures,
  the queue counts, the data map, the guides' and the feature explainers' facts, a record's
  network).

The demo layout and its Custom components ship with the Forest CLI.

## Partner portal

The `Submit application` and `Upload document` Smart Actions accept files from a partner portal.
`DEMO_BANK_PORTAL_ORIGINS` (comma-separated) lists the portal addresses allowed to send them;
default `http://localhost:3500,http://127.0.0.1:3500`.
