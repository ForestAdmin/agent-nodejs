---
status: accepted
date: 2026-09-09
tags: [workflow-executor, datasource-semantics]
affected_components: [workflow-executor]
---

# A case-insensitive Decision follows Postgres's ILIKE, whatever the datasource

`i_contains` folds case and keeps accents — `'É'` matches `'é'`, `'é'` does not match `'e'` — which is the Postgres `ILIKE` path the list view filter runs on there; the rest of the string family stays case-sensitive. MySQL's and SQLite's default collations differ, so on those datasources a Decision and the list filter on the same field can disagree on the same record, and that divergence is accepted: the executor compares values already loaded into JS and has no collation to consult. Rejected: following each datasource's collation, which makes routing depend on the database a run happens to read and can put one workflow on two behaviours across a replica; and folding accents too, one rule everywhere but unlike every filter the customer sees.
