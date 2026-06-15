# @forestadmin/datasource-demo-fintech

In-memory demo data source for Forest Admin, themed around a fintech /
compliance back office (customers, cards, KYC, AML alerts, chargebacks…).

It requires no database and is used by `forest create demo` to bootstrap a
project with realistic sample data.

```ts
import { createDemoFintechDataSource } from '@forestadmin/datasource-demo-fintech';

agent.addDataSource(createDemoFintechDataSource());
```

## Regenerating the demo data

The records in `src/collections/*.ts` are produced by a deterministic generator
(fixed PRNG seed → reproducible, no external dependency). To refresh or rescale
the dataset, edit `scripts/generate.ts` (e.g. the `N` constant) and run:

```sh
yarn workspace @forestadmin/datasource-demo-fintech generate
yarn workspace @forestadmin/datasource-demo-fintech build
yarn workspace @forestadmin/datasource-demo-fintech lint --fix   # format the output
```

Dates are emitted as `daysAgo(n)` / `dayOnlyAgo(n)` (see `src/dates.ts`) so the
demo always shows recent data, whenever the project is run. The generator is a
dev tool only — it is not part of the published package.
