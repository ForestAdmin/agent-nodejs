---
status: accepted
date: 2026-09-22
tags: [workflow-executor, automation, data-residency]
affected_components: [workflow-executor]
---

# The automation sweep sends record ids to the orchestrator, and decides nothing itself

Forest Runtime runs on the customer's infrastructure, and the sweep of an automated inbox is the one place where identifiers of the customer's records leave it: the poller reads its segment, then posts those ids to `POST /automated-inboxes/:inboxId/sync`, where the orchestrator alone decides what to start, applies the cap of 20, refuses duplicates and escalates what a workflow left behind. Accepted cost: primary key values of the customer's records transit and are stored in Forest's database as `inboxAssignments.recordId` — every other field of those records stays on the customer's side, but the ids do not. Chosen because the decision needs state the runtime does not have and must not hold: the assignments of every instance, the runs already live, the fallback inbox, the advisory lock that makes two overlapping sweeps safe. Rejected: deciding in the runtime, which means replicating that state per instance and electing a leader for correctness rather than for cost; and hashing the ids before sending, which buys nothing — the orchestrator has to name the record back to the customer's own inbox, so the mapping would have to travel too.
