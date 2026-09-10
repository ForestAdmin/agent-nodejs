---
status: accepted
date: 2026-09-10
tags: [datasource-semantics, condition-tree]
affected_components: [datasource-toolkit]
---

# A date interval includes its first instant, so every record belongs to a day

`Today`, `Yesterday`, `PreviousWeek`, `PreviousMonth`, `PreviousQuarter`, `PreviousYear`, `PreviousXDays` and the `…ToDate` family all expand through one `interval()` helper, which paired a strict lower bound with a strict upper one on `Date` columns: `Today` asked for `> local midnight`, `Yesterday` for `< local midnight`. A record stored at exactly local midnight therefore satisfied neither, and no interval operator could reach it — one instant per day belonged to no day at all. The bound is now `GreaterThanOrEqual` for `Date` as it already was for `Dateonly` since #1231, making every interval half-open `[start, end)`: consecutive intervals tile the timeline with no hole and no overlap, and the operator set regains the property that a record is always in exactly one day.

Measured, not inferred: the same `Today` question against a v1 liana and a v2 agent over a row moved onto the boundary returned the row on v1 and not on v2, so the two generations disagreed on which records exist — visible to any customer whose BFF fronts both. v1 was right. Rejected: leaving the bound strict and documenting the hole, which keeps a filter that silently omits records; and making the upper bound inclusive too, which would place a midnight record in two days and double-count it in every aggregation.
