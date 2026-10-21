---
status: accepted
date: 2026-10-21
tags: [workflow-executor, run-lock, multiple-related-records]
affected_components: [workflow-executor]
---

# A step running once per record renews its run lock with the orchestrator before each record

A step running once per record can outlast the orchestrator's 7-minute run lock, and an operator's abort must stop it before its next record. So before each record the runtime calls `POST /api/workflow-orchestrator/renew-run-lock` on forestadmin-server with the lock it holds: a 409 (the run was aborted or its lock lost) stops the step without reporting, and an orchestrator that cannot answer leaves the step running under the lock it already holds. Accepted cost: released runtimes call this route, so the orchestrator must keep serving it, and a run whose renewals go unanswered for 7 minutes can still be claimed by another runtime. Rejected: handing the run back and claiming it again about once a minute, which needs no route but lets an abort wait up to a minute while more records run, and one record per dispatch, the simplest loop but up to 30 seconds between records, 25 minutes for 50.
