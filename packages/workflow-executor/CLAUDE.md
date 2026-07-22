# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Keep this file current.** When you add a step type, port, executor, error category, or invariant, update the relevant section. Keep entries terse — one or two lines each.

## Overview

`@forestadmin/workflow-executor` — a framework-agnostic TypeScript library that runs Forest Admin workflow **steps on the client's infrastructure**, next to the Forest Admin agent. The orchestrator sends only step *definitions* (metadata, never client data); this package fetches them, executes locally with access to client data, and reports outcomes back.

**Why it exists:** workflows historically ran entirely in the **frontend** (BPMN parsing, run state machine, AI calls, tool execution). That blocks automation (scheduled / API-triggered / headless runs need a browser open). This package moves step execution to the backend. It must stay **behavior-ISO with the front** (`forestadmin/frontend`, `app/features/workflow/`): same tool schemas, AI interactions, fallback logic.

## System architecture (4 components)

```
Front  ◀──▶  Orchestrator  ◀──pull/push──▶  Executor (this pkg)  ──▶  Agent (datasources)
```
- **Front** — designs workflows, triggers runs, shows progress. Still executes the `awaiting-input` path (manual decisions, action forms).
- **Orchestrator** (Forest server) — stores definitions, manages run state machines, dispatches steps. Never sees client data.
- **Executor** (this pkg) — pulls pending steps, runs them locally, reports `StepOutcome`. **The privacy boundary lives here.**
- **Agent** (`@forestadmin/agent`) — datasource proxy: collections/fields/actions read & written via `AgentPort`, never direct DB access.

## Key directories (`src/`)

- `runner.ts` — main entry: `Runner` (start/stop/triggerPoll, HTTP wiring, graceful drain, auto-chain).
- `executors/` — one per step type + infra: `base-step-executor.ts` (template method, idempotency hook, error→outcome), `record-step-executor.ts` (shared record-step base), `trigger-record-action-step-executor.ts` (the `trigger-action` step), `step-executor-factory.ts`, `agent-with-log.ts` + `activity-log.ts` (audit-logged agent wrapper for mutating ops). Step types (`StepType`): `condition`, `read-record`, `update-record`, `trigger-action`, `load-related-record`, `mcp`, `guidance`.
- `ports/` — IO interfaces (all external IO is injected): `agent-port.ts` (datasource: getRecord/updateRecord/getRelatedData/getSingleRelatedData/resolvePolymorphicType/executeAction/getActionFormInfo/getActionForm/probe), `workflow-port.ts` (orchestrator), `run-store.ts` (per-run state), `mcp-oauth-credentials-store.ts` (`McpOAuthCredentialsStore` — at-rest OAuth-MCP creds; Database + InMemory impls).
- `adapters/` — port impls: `agent-client-agent-port.ts` (via `@forestadmin/agent-client`), `forest-server-workflow-port.ts` (HTTP via `forestadmin-client` `ServerUtils`).
- `stores/` — `InMemoryStore` (tests + the `--in-memory` CLI mode, not for prod), `DatabaseStore` (Sequelize + umzug, `forest` schema), `database-mcp-oauth-credentials-store.ts` / `in-memory-mcp-oauth-credentials-store.ts` (OAuth-MCP creds store, migration `002`), `schema-migrations.ts` (shared `forest`-schema + advisory-lock migration runner), `build-run-store.ts` factories.
- `crypto/credential-encryption.ts` — at-rest encryption: HKDF (`FOREST_EXECUTOR_ENCRYPTION_KEY`) + AES-256-GCM, lazy key, fail-closed.
- `types/validated/` — zod schemas + inferred types for everything crossing a trust boundary (`step-definition.ts`, `step-outcome.ts`, `collection.ts`, `execution.ts`). Non-validated runtime types live in `types/*.ts`.
- `errors.ts` — error hierarchy (see below). `http/executor-http-server.ts` — optional Koa server for the front (`GET /runs/:runId`, `POST /runs/:runId/trigger`, `POST`/`DELETE /mcp-oauth-credentials`); `http/mcp-oauth-credentials.ts` — `.strict()` deposit-body zod + `buildMcpOAuthCredentialInput` mapper.

## Step types & execution modes

`StepExecutionMode` (domain enum, mapped from the server contract in `step-definition-mapper.ts`): `Manual`, `AutomatedWithConfirmation`, `FullyAutomated`.

- **Trigger Action** (`trigger-record-action-step-executor.ts`, `handleFirstCall`) — detects the form via `getActionForm` (full field list, not `getActionFormInfo`). Formless: `FullyAutomated` runs it *in the executor* via the audited agent; otherwise pauses. With a form: `Manual` pauses with the native form (no AI fill); `AutomatedWithConfirmation` AI-fills then pauses for the user to submit natively; `FullyAutomated` AI-fills (`fillFormWithAi`) and, if `filledForm.canExecute`, submits in the executor — falling back to `awaiting-input` (pause) when required fields are missing, or on `ActionFormValidationError`/`ActionRequiresApprovalError` (a human can finish those). `UnsupportedActionFormError` is declared/exported but **never thrown** in src.
- **Pre-recorded args** — record steps accept `preRecordedArgs` to skip AI. Technical names (`fieldName`/`fieldNames`/`actionName`/`relationName`) are matched exactly via `findFieldByTechnicalName` (no fuzz); `resolveAiFieldName` (exact-then-normalized) is reserved for AI-returned display names. The source record differs by step: read-record/update-record use `selectedRecordStepIndex` (a runtime index, resolved in `resolveRecordRef`); trigger-action/load-related-record use `selectedRecordStepId` — a **stable BPMN step id** (or `WORKFLOW_START_STEP_ID` sentinel) resolved by `resolveSourceRecordRef`, chosen to survive the index shifts a revision causes. Partial args supported. Unresolvable → `FieldNotFoundError`/`ActionNotFoundError`/`RelationNotFoundError`; bad shape / out-of-range index → `InvalidPreRecordedArgsError`.

## Invariants (read before changing executors)

- **Privacy** — `StepOutcome` goes to the orchestrator and must **never** contain client data. Privacy-sensitive info (AI reasoning, record values) stays in `StepExecutionData` (RunStore, client-side only).
- **Error hierarchy** (`errors.ts`):
  - *Step-execution errors* extend `WorkflowExecutorError` → caught by `base-step-executor.ts`, turned into `stepOutcome.error`. Never reach HTTP.
  - *Boundary errors* (`ConfigurationError`, `PendingDataNotFoundError`, `AgentProbeError`, …) extend plain `Error` → caught at HTTP/Runner layer. They must **not** extend `WorkflowExecutorError` (or the base executor would swallow them).
  - `WorkflowExecutorError` carries `message` (technical, logs) **and** `userMessage` (end-user, surfaced via `stepOutcome.error`). New subclasses must set a distinct, jargon-free `userMessage`. Request-level errors extend a *category* (`NotFoundError`/`AccessDeniedError`/`UnavailableError`) so `toHttpError` maps status by category — no per-error binding.
- **`displayName` vs technical name** — AI tools/prompts use `displayName` (the admin-configured label end users write against), never `fieldName`. Map AI-returned display names back to technical names before any datasource op.
- **Idempotency (mutating steps: update-record, trigger-action, mcp)** — write-ahead log in the RunStore: save `idempotencyPhase: 'executing'` before the side effect, `'done'` + `executionResult` after. On re-dispatch `(runId, stepIndex)`: `done` → rebuild success outcome without re-running or re-logging; `executing` → throw `StepStateError`. `checkIdempotency()` runs before `doExecute()`; the `executing` marker is set in the `beforeCall` thunk passed to `AgentWithLog` (after `createPending`) so a log-creation failure leaves no orphan marker. Non-mutating steps don't override it (replay is safe).
- **Fetched steps must execute** — any step from `getAvailableRuns()` must run; silently dropping one breaks the orchestrator contract. The only allowed pre-filter is `inFlightRuns` dedup (keyed by `runId`, not step — a chain advances `stepId`).
- **Auto-chain** — `WorkflowPort.updateStepExecution` returns the next dispatch (or `null`); the Runner runs it inline instead of waiting for the next poll. Exits on `null` / non-progressing `stepIndex` / `maxChainDepth` (default 50) / `stop()`. Each step uses its own dispatch's `forestServerToken`. `/update-step` is retried on transient failures → the orchestrator **must** dedupe identical `(runId, stepIndex)` outcomes (server-side idempotency) to avoid double side-effects.
- **Revise-safety** — on revision the orchestrator marks the pivot `revised`, later entries `cancelled`, then appends clones (`originalStepIndex` → source) + a fresh re-exec of the revised step. Consumers of `workflowHistory` must keep only the live path (`!revised && !cancelled`). To find a step's RunStore record: own `stepIndex` first, then fall back to `originalStepIndex`. Never key on `stepName` (LinkTo loops repeat names).
- **Boundary validation** — wire/mapper types live in `types/validated/` as zod. Strictness by origin: executor-produced + frontend bodies use `.strict()`; the orchestrator collection schema **strips** unknowns and asserts step-specific props at use-time (resilient to orchestrator drift). Parse failure → `DomainValidationError`/`InvalidStepDefinitionError`. `StepOutcome` is validated only when it arrives via `previousSteps`; executor outputs are trusted by construction.
- **DatabaseStore** — table `workflow_step_executions` + migration registry namespaced under a schema (default `forest`, override via `DATABASE_SCHEMA`), so a DB shared with the agent/server is safe. The schema is created idempotently at `init()`, but gated on a `pg_namespace` existence probe (not `CREATE SCHEMA IF NOT EXISTS` alone): Postgres checks database-level `CREATE` even for `IF NOT EXISTS`, so probing lets a pre-created schema boot with only schema-level `CREATE`. SQLite (tests) skips schemas. Migrations run behind a **transaction-scoped Postgres advisory lock** (`pg_advisory_xact_lock`, safe behind RDS Proxy / PgBouncer) so HA cold-starts migrate once; migrations are transactional + idempotent. Postgres-only; the lock key is a fixed constant — never change it.
- **Graceful shutdown** — `stop()` drains in-flight steps (`idle → running → draining → stopped`), `stopTimeoutMs` default 30s, HTTP stays up during drain. Signal handling is the consumer's job.
- **Logging** — `Logger = (level, message, context?) => void`. `BaseStepExecutor` stamps `logCtx` (runId/stepId/stepIndex/stepType); type-specific ids via `getExtraLogContext()`. `createConsoleLogger`/`createPrettyLogger(minLevel)` factories; CLI level from `LOG_LEVEL` (default `Info`).
- **Config comes from the boundary, never `process.env`** — every env var is parsed in `cli-core` (standalone) or accepted as an option (`ExecutorOptions` / the agent's `addWorkflowExecutor` options) and then injected. Nothing under `src/` reads `process.env` except the CLI entrypoint; the check for a value is `Boolean(options.x)`, not `process.env`. This keeps the executor identically configurable standalone and embedded, and testable without mutating env. (Regression fixed once: `FOREST_EXECUTOR_ENCRYPTION_KEY` was read in `crypto/` — now injected via `executorEncryptionKey`.)
- **AI** — import every AI type (`BaseChatModel`, `DynamicStructuredTool`, `SystemMessage`/`HumanMessage`, `RemoteTool`/`ToolConfig`) from `@forestadmin/ai-proxy`, **not** `@langchain/core` (which is not a dependency). `ExecutionContext.model` is a `BaseChatModel`. The only langchain mention in src is a comment in `cli.ts` about transitively loading `@langchain/openai`.

## Commands

Requires **Node ≥ 22.12** (`package.json` `engines`). With an older Node, `yarn workspace …` refuses on the engine check — prefix `YARN_IGNORE_ENGINES=1` to unblock locally (CI runs the right version).

```bash
yarn workspace @forestadmin/workflow-executor build   # tsc
yarn workspace @forestadmin/workflow-executor test    # jest
yarn workspace @forestadmin/workflow-executor lint    # eslint src test

# single test (jest): by path or by name
yarn workspace @forestadmin/workflow-executor test -- src/executors/condition-step-executor.test.ts
yarn workspace @forestadmin/workflow-executor test -- -t "auto-chain"
```

## Gotchas

- **Stale cross-package build cache.** This package consumes `@forestadmin/agent-client`'s built `dist`. After changing agent-client, rebuild it before building/testing here. The lerna/nx build cache can serve a **stale agent-client dist** (you'll see phantom "no exported member" / wrong-arity errors against agent-client) — bust it with a source change or, in CI, an empty commit.
- **Running it end-to-end is hard** — the executor needs a live orchestrator + agent. Verify changes with the test suite (`InMemoryStore` + mocked ports), not by booting it.
- **DB tests** use SQLite; the real-Postgres test (`database-store.pg.test.ts`) is gated on `WORKFLOW_EXECUTOR_TEST_DATABASE_URL` and skipped in CI.

## Testing

- Prefer **integration tests** over unit tests; AAA (Arrange/Act/Assert); test behavior, not implementation.
- **Strong assertions**: verify exact arguments/outcomes, not just that a function was called.
