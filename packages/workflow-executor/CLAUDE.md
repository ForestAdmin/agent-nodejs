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
- **Pre-recorded args** — record steps accept `preRecordedArgs` to skip AI. Technical names (`fieldName`/`fieldNames`/`actionName`/`relationName`) are matched exactly via `findFieldByTechnicalName` (no fuzz); `resolveAiFieldName` (exact-then-normalized) is reserved for AI-returned display names. All four record steps pin the source by `selectedRecordStepId` — a **stable BPMN step id** (or the `WORKFLOW_START_STEP_ID` sentinel) resolved by `resolveSourceRecordRef`, chosen to survive the index shifts a revision causes; the editor writes it and treats it as a precondition for choosing fields. Presence, not truthiness, decides whether the **source** is pinned: all four record steps check `selectedRecordStepId !== undefined`, so an empty id is a pin that lost its target -- it resolves to nothing and raises `InvalidPreRecordedArgsError` instead of falling back to AI selection, which would silently retarget the step at another record. `actionName` (`trigger-action`) and `relationName` (`load-related`) still gate on truthiness, so an empty value there does fall through to the AI; neither is reachable from the editor, which writes `stepId || undefined`. `selectedRecordStepIndex` (a runtime index, resolved in `resolveRecordRef`) survives only as a fallback on read-record/update-record, checked after the step id. Partial args supported. Unresolvable → `ActionNotFoundError`/`RelationNotFoundError`, or `PinnedFieldNotFoundError` for a field; bad shape / out-of-range index → `InvalidPreRecordedArgsError`. A pinned field takes its own class because `FieldNotFoundError`'s message tells the operator to rephrase the prompt — the right remedy for a name the AI chose, and unreachable for one the workflow fixed. Anything raised on a pinned value has to name the step as the thing to edit.

## Invariants (read before changing executors)

- **Privacy** — `StepOutcome` goes to the orchestrator and must **never** contain client data. Privacy-sensitive info (AI reasoning, record values) stays in `StepExecutionData` (RunStore, client-side only).
- **Error hierarchy** (`errors.ts`):
  - *Step-execution errors* extend `WorkflowExecutorError` → caught by `base-step-executor.ts`, turned into `stepOutcome.error`. Never reach HTTP.
  - *Boundary errors* (`ConfigurationError`, `PendingDataNotFoundError`, `AgentProbeError`, …) extend plain `Error` → caught at HTTP/Runner layer. They must **not** extend `WorkflowExecutorError` (or the base executor would swallow them).
  - `WorkflowExecutorError` carries `message` (technical, logs) **and** `userMessage` (end-user, surfaced via `stepOutcome.error`). New subclasses must set a distinct, jargon-free `userMessage`. Request-level errors extend a *category* (`NotFoundError`/`AccessDeniedError`/`UnavailableError`) so `toHttpError` maps status by category — no per-error binding.
  - **Error kind** — `errorKind` (`operator`/`configuration`/`system`) classifies what kind of failure a step error is. It does not encode ownership: the front maps `configuration`/`system` to admin-phrased copy as a reasonable default, which is a front-end choice, not a property of the enum. One abstract per classified kind declares it once (`WorkflowOperatorError`, `WorkflowConfigurationError`, each setting `static defaultErrorKind`); a new member joins a family by extending it, and an error extending neither stays unclassified. The throw site overrides only where the same error can be either kind (`SourceRecordMissingError`, on whether a candidate was offered). Unset ⇒ absent from the outcome ⇒ the front frames it as it always has, so leaving a new error unclassified is safe. `errorSourceStepIndex` names the step an error is *about*, by index rather than step id — a LinkTo loop repeats ids, so only the index identifies the iteration.
  - Both fields ride `context` on the update-step request and are read back by `run-to-available-step-mapper`, which drops an off-vocabulary value instead of passing it on: it would fail `AvailableStepExecutionSchema.parse` and take the whole run down. The front equality-matches `operator`, so a widened enum degrades an older front rather than breaking it.
  - The orchestrator merges step `context` shallowly and an unclassified error omits `errorKind` rather than nulling it, so a kind written on a step index cannot be cleared server-side. That is safe only because no index ever receives two error reports: an error sets `done: true`, a done step is never re-dispatched, and every start appends a fresh index with an empty context. If a retryable error is ever left pending instead of done, this stops holding.
  - `errorKind` is unrelated to ai-proxy's `McpLoadFailureKind` (`auth`/`connection`/`unknown`, reported per server on the MCP `failures` channel): that one says where a tool load broke, this one says what kind of failure the step hit. They are deliberately separate vocabularies — don't map one onto the other.
- **`displayName` vs technical name** — AI tools/prompts use `displayName` (the admin-configured label end users write against), never `fieldName`. Map AI-returned display names back to technical names before any datasource op.
- **Idempotency (mutating steps: update-record, trigger-action, mcp)** — write-ahead log in the RunStore: save `idempotencyPhase: 'executing'` before the side effect, `'done'` + `executionResult` after. On re-dispatch `(runId, stepIndex)`: `done` → rebuild success outcome without re-running or re-logging; `executing` → throw `StepStateError`. `checkIdempotency()` runs before `doExecute()`; the `executing` marker is set in the `beforeCall` thunk passed to `AgentWithLog` (after `createPending`) so a log-creation failure leaves no orphan marker. Non-mutating steps don't override it (replay is safe).
- **Fetched steps must execute** — any step from `getAvailableRuns()` must run; silently dropping one breaks the orchestrator contract. The only allowed pre-filter is `inFlightRuns` dedup (keyed by `runId`, not step — a chain advances `stepId`).
- **Auto-chain** — `WorkflowPort.updateStepExecution` returns the next dispatch (or `null`); the Runner runs it inline instead of waiting for the next poll. Exits on `null` / non-progressing `stepIndex` / `maxChainDepth` (default 50) / `stop()`. Each step uses its own dispatch's `forestServerToken`. `/update-step` is retried on transient failures → the orchestrator **must** dedupe identical `(runId, stepIndex)` outcomes (server-side idempotency) to avoid double side-effects.
- **Revise-safety** — on revision the orchestrator marks the pivot `revised`, later entries `cancelled`, then appends clones (`originalStepIndex` → source) + a fresh re-exec of the revised step. Consumers of `workflowHistory` must keep only the live path (`!revised && !cancelled`). To find a step's RunStore record: own `stepIndex` first, then fall back to `originalStepIndex`. Never key on `stepName` (LinkTo loops repeat names).
- **Boundary validation** — wire/mapper types live in `types/validated/` as zod. Strictness by origin: executor-produced + frontend bodies use `.strict()`; the orchestrator collection schema **strips** unknowns and asserts step-specific props at use-time (resilient to orchestrator drift). Parse failure → `DomainValidationError`/`InvalidStepDefinitionError`. `StepOutcome` is validated only when it arrives via `previousSteps`; executor outputs are trusted by construction.
- **DatabaseStore** — table `workflow_step_executions` + migration registry namespaced under a schema (default `forest`, override via `DATABASE_SCHEMA`), so a DB shared with the agent/server is safe. The schema is created idempotently at `init()`, but gated on a `pg_namespace` existence probe (not `CREATE SCHEMA IF NOT EXISTS` alone): Postgres checks database-level `CREATE` even for `IF NOT EXISTS`, so probing lets a pre-created schema boot with only schema-level `CREATE`. SQLite (tests) skips schemas. Migrations run behind a **transaction-scoped Postgres advisory lock** (`pg_advisory_xact_lock`, safe behind RDS Proxy / PgBouncer) so HA cold-starts migrate once; migrations are transactional + idempotent. Postgres-only; the lock key is a fixed constant — never change it.
- **Trigger acknowledges the claim, not the outcome** — `triggerPoll` returns once the run is claimed and validated (`RunAlreadyInFlight` / `RunNotFound` / `UserMismatch` all precede it); the chain then runs detached. Outcomes travel only via `updateStepExecution`, never through the HTTP response, so awaiting the chain added no information while holding the request open for up to `stepTimeoutS × maxChainDepth` — long enough for any edge in front of the executor to cut it (PRD-923). What bounds a trigger chain is now the `stop()` drain, not the caller.
- **Graceful shutdown** — `stop()` drains in-flight steps (`idle → running → draining → stopped`), `stopTimeoutMs` default 30s, HTTP stays up during drain. Signal handling is the consumer's job. Trigger-started chains fall under the same drain as polled ones: a deploy mid-chain truncates them at `stopTimeoutS` (they used to be held open by the unanswered request).
- **Logging** — `Logger = (level, message, context?) => void`. `BaseStepExecutor` stamps `logCtx` (runId/stepId/stepIndex/stepType); type-specific ids via `getExtraLogContext()`. `createConsoleLogger`/`createPrettyLogger(minLevel)` factories; CLI level from `LOG_LEVEL` (default `Info`). ai-proxy's logger takes the cause as a third `Error` argument instead of a context object, so both AI adapters bridge it with `toAiProxyLogger` (flattens to `{ error, cause, stack }` — an `Error`'s own properties are non-enumerable and would vanish from the emitted line — and swallows a throwing host logger, which ai-proxy calls from inside its catch blocks).
- **MCP load failures come from the `failures` channel** — `RemoteToolFetcher` loads through `loadRemoteToolsWithFailures` and reports what the providers classified (`server`/`kind`/`error`); never infer failure from absent tools, which flags a healthy server exposing none. `loadFailed` drives the 503 on `GET /list-mcp-tools`, so a wrong inference is user-visible.
- **Config comes from the boundary, never `process.env`** — no executor *config* is read from `process.env` outside `cli-core`: every knob is parsed there (standalone) or injected as an option (`ExecutorOptions` / the agent's `addWorkflowExecutor` options), and the check for a value is `Boolean(options.x)`, not `process.env`. Runtime-mode flags — `NODE_ENV` (forceAiError prod-guard, token-endpoint dev check) and the `OTEL_*` observability vars in `tracing.ts` — are the deliberate exception. This keeps the executor identically configurable standalone and embedded, and testable without mutating env. (Regression fixed once: `FOREST_EXECUTOR_ENCRYPTION_KEY` was read in `crypto/` — now injected via `executorEncryptionKey`.)
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
