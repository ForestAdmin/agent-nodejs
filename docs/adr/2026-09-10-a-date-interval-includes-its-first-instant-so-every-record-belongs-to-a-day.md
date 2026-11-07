---
status: accepted
date: 2026-09-10
tags: [datasource-semantics, condition-tree]
affected_components: [datasource-toolkit, workflow-executor]
---

# A date interval includes its first instant, so every record belongs to a day

`Today`, `Yesterday`, `PreviousWeek`, `PreviousMonth`, `PreviousQuarter`, `PreviousYear`, `PreviousXDays` and the `…ToDate` family all expand through one `interval()` helper, which paired a strict lower bound with a strict upper one on `Date` columns: `Today` asked for `> local midnight`, `Yesterday` for `< local midnight`. A record stored at exactly local midnight therefore satisfied neither, and no interval operator could reach it: not `Today`, not `Yesterday`, not `PreviousMonth`. It was invisible to every date filter the product offers. That is the defect — rows no question can reach — and it stands on its own, with or without a second agent generation in the picture. Columns fed by an import or by a business date are routinely truncated to midnight, so for a project whose timezone matches the truncation zone the unreachable set is not one row, it is a table.

The bound is now `GreaterThanOrEqual` for `Date` as it already was for `Dateonly` since #1231, making every interval half-open `[start, end)`: consecutive intervals tile the timeline with no hole and no overlap, and the operator set regains the property that a record is always in exactly one day.

Two other places carried the same rule and had to move with it, or the fix would have relocated the disagreement instead of ending it. `FilterFactory.getPreviousPeriodFilter` builds the comparison window of the growth charts; it kept a strict lower bound and an `endOf`-based upper one, so the current period would have included its first instant while the period it is compared against excluded it, and the final millisecond of that period was dropped as well. It is half-open now too. `workflow-executor`'s deterministic condition evaluator deliberately replicated the old asymmetry so that a Decision and a list filter answered "today" alike; replicating it after this change would have made a workflow and a list disagree on the same record, so it follows the same `[start, end)` rule.

The change is monotone: a row that satisfied an interval still satisfies it, and rows are only added. Nothing empties, nothing breaks, but counts move and a KPI can shift — this ships as a minor with a release note, not as a silent patch.

Measured, not inferred: the same `Today` question against a v1 liana and a v2 agent over a row moved onto the boundary returned the row on v1 and not on v2. That divergence is a consequence of the defect rather than its cause, and v1 was right. Rejected: leaving the bound strict and documenting the hole, which keeps a filter that silently omits records; making the upper bound inclusive too, which would place a midnight record in two days and double-count it in every aggregation; and putting the fix behind an opt-in flag, which would freeze the broken behaviour as the default for every existing project and add a knob to carry in every SDK.
