# @forestadmin/workflow-executor

> **Note to Claude**: Keep this file up to date. When adding a new feature, module, architectural pattern, or dependency, update the relevant section below.

## Overview

TypeScript library (framework-agnostic) that executes workflow steps on the client's infrastructure, alongside the Forest Admin agent. The orchestrator never sees client data — it only sends step definitions; this package fetches them and runs them locally.

## Why this package exists — Frontend → Backend migration

Workflows currently run entirely in the **frontend** (`forestadmin/frontend`). The front parses BPMN, manages the run state machine, calls the AI, executes tools, and handles user interactions — all in the browser.

This works for interactive use cases but blocks **automation**: scheduled workflows, API-triggered runs, and headless execution all require a human with a browser open. The goal of this migration is to move workflow execution to the **backend** (client-side agent infrastructure) so workflows can run without a frontend and without human intervention.

### What stays on the front
- Workflow designer (BPMN editor)
- Run monitoring / progress display
- Manual decisions when the AI can't decide (`manual-decision` status)

### What moves to the backend (this package)
- Step execution (condition decisions, AI tasks, record operations)
- AI calls (gateway option selection, tool selection, tool execution)
- Record selection and data access (via AgentPort)

### Constraint: must be ISO with front
The executor must produce the same behavior as the frontend implementation (`forestadmin/frontend`, `app/features/workflow/`). Same tool schemas, same AI interactions, same fallback logic.

## System Architecture

The workflow system is split into 4 components:

- **Front** — The Forest Admin UI. Users design workflows (sequence of steps) and trigger runs. Displays run progress and results in real time.
- **Orchestrator** — Forest Admin backend. Stores workflow definitions, manages run state machines, and dispatches steps. Never sees client data — only step metadata.
- **Executor** _(this package)_ — Runs on the client's infrastructure. Polls the orchestrator for pending steps, executes them locally (with access to client data), and reports results back. Privacy boundary lives here.
- **Agent** — The Forest Admin agent (`@forestadmin/agent`). Acts as a proxy for the executor — provides access to the datasource layer (collections, actions, fields) so the executor can read/write client data without direct database access.

```
Front  ◀──▶  Orchestrator  ◀──pull/push──▶  Executor  ──▶  Agent (datasources)
```

## Package Structure

```
src/
├── errors.ts               # WorkflowExecutorError, MissingToolCallError, MalformedToolCallError, NoRecordsError, NoReadableFieldsError, NoWritableFieldsError, NoActionsError, StepPersistenceError, NoRelationshipFieldsError, RelatedRecordNotFoundError, InvalidPreRecordedArgsError
├── runner.ts               # Runner class — main entry point (start/stop/triggerPoll, HTTP server wiring, graceful drain)
├── types/                  # Core type definitions (@draft)
│   ├── validated/          # Types validated at a trust boundary (zod schemas + inferred types)
│   │   ├── collection.ts   # CollectionSchema, FieldSchema, ActionSchema, RecordRef, RecordData
│   │   ├── execution.ts    # AvailableStepExecution, StepUser, Step
│   │   ├── step-definition.ts  # StepType enum + 7 step definition variants
│   │   └── step-outcome.ts # StepOutcome + 4 variants (validated when input via previousSteps)
│   ├── execution-context.ts  # ExecutionContext + StepExecutionResult + IStepExecutor (runtime, not validated)
│   └── step-execution-data.ts # Runtime state for in-progress steps (not validated)
├── ports/                  # IO boundary interfaces (@draft)
│   ├── agent-port.ts       # Interface to the Forest Admin agent (datasource)
│   ├── workflow-port.ts    # Interface to the orchestrator
│   └── run-store.ts        # Interface for persisting run state (scoped to a run)
├── stores/                 # RunStore implementations
│   ├── in-memory-store.ts  # InMemoryStore — Map-based, for tests
│   ├── database-store.ts   # DatabaseStore — Sequelize + umzug migrations (table + migration registry namespaced in the `forest` schema on Postgres)
│   └── build-run-store.ts  # Factory functions: buildDatabaseRunStore, buildInMemoryRunStore
├── adapters/               # Port implementations
│   ├── agent-client-agent-port.ts      # AgentPort via @forestadmin/agent-client
│   └── forest-server-workflow-port.ts  # WorkflowPort via HTTP (forestadmin-client ServerUtils)
├── executors/              # Step executor implementations
│   ├── base-step-executor.ts       # Abstract base class (context injection + shared helpers)
│   ├── condition-step-executor.ts  # AI-powered condition step (chooses among options)
│   ├── read-record-step-executor.ts  # AI-powered record field reading step
│   ├── update-record-step-executor.ts # AI-powered record field update step (with confirmation flow)
│   ├── trigger-record-action-step-executor.ts  # AI-powered action trigger step (with confirmation flow)
│   ├── load-related-record-step-executor.ts  # AI-powered relation loading step (with confirmation flow)
│   └── guidance-step-executor.ts  # Manual guidance step (saves user input, no AI)
├── http/                   # HTTP server (optional, for frontend data access)
│   └── executor-http-server.ts  # Koa server: GET /runs/:runId, POST /runs/:runId/trigger
└── index.ts                # Barrel exports
```

## Architecture Principles

- **Pull-based** — The executor polls for pending steps via a port interface (`WorkflowPort.getAvailableRuns`; polling loop not yet implemented).
- **Atomic** — Each step executes in isolation. A run store (scoped per run) maintains continuity between steps.
- **Privacy** — Zero client data leaves the client's infrastructure. `StepOutcome` is sent to the orchestrator and must NEVER contain client data. Privacy-sensitive information (e.g. AI reasoning) must stay in `StepExecutionData` (persisted in the RunStore, client-side only).
- **Ports (IO injection)** — All external IO goes through injected port interfaces, keeping the core pure and testable.
- **AI integration** — Uses `@langchain/core` (`BaseChatModel`, `DynamicStructuredTool`) for AI-powered steps. `ExecutionContext.model` is a `BaseChatModel`.
- **Error hierarchy** — Two families of errors coexist in `src/errors.ts`:
  - **Domain errors** (`extends WorkflowExecutorError`) — Thrown during step execution (e.g. `RecordNotFoundError`, `MissingToolCallError`). Caught by `base-step-executor.ts` and converted into `stepOutcome.error` sent to the orchestrator. All domain errors must extend `WorkflowExecutorError`.
  - **Boundary errors** (`extends Error`) — Thrown outside step execution, at the HTTP or Runner layer (e.g. `RunNotFoundError`, `PendingDataNotFoundError`, `ConfigurationError`). Caught by the HTTP server and translated into HTTP status codes (404, 400, etc.). These intentionally do NOT extend `WorkflowExecutorError` to prevent `base-step-executor` from catching them as step failures.
- **Dual error messages** — `WorkflowExecutorError` carries two messages: `message` (technical, for dev logs) and `userMessage` (human-readable, surfaced to the Forest Admin UI via `stepOutcome.error`). The mapping happens in a single place: `base-step-executor.ts` uses `error.userMessage` when building the error outcome. When adding a new error subclass, always provide a distinct `userMessage` oriented toward end-users (no collection names, field names, or AI internals). If `userMessage` is omitted in the constructor call, it falls back to `message`.
- **displayName in AI tools** — All `DynamicStructuredTool` schemas and system message prompts must use `displayName`, never `fieldName`. `displayName` is a Forest Admin frontend feature that replaces the technical field/relation/action name with a product-oriented label configured by the Forest Admin admin. End users write their workflow prompts using these display names, not the underlying technical names. After an AI tool call returns display names, map them back to `fieldName`/`name` before using them in datasource operations (e.g. filtering record values, calling `getRecord`).
- **Idempotency in mutating executors** — `update-record`, `trigger-action`, and `mcp` executors protect against duplicate side effects via a write-ahead log in the `RunStore`. Before the side effect fires, the executor saves `idempotencyPhase: 'executing'`. After, it saves `idempotencyPhase: 'done'` alongside the normal `executionResult`. On re-dispatch (same `runId + stepIndex`): `done` → reconstruct success outcome via `buildOutcomeResult` without re-executing or emitting an activity log; `executing` → throw `StepStateError` (user retries manually, also no activity log). The `checkIdempotency()` hook in `BaseStepExecutor` runs before `doExecute()` so neither cache hits nor uncertain-state errors reach the activity log emitted by `AgentWithLog`. The `executing` write-ahead marker is saved in the `beforeCall` thunk the executor passes to `AgentWithLog`'s write methods (run after `createPending`, just before the side effect) so an activity-log creation failure never leaves an orphan `executing` marker. Non-mutating executors (`condition`, `read-record`, `guidance`, `load-related-record`) do not override `checkIdempotency()` — replaying them is safe.
- **Fetched steps must be executed** — Any step retrieved from the orchestrator via `getAvailableRuns()` must be executed. Silently discarding a fetched step (e.g. filtering it out by `runId` after fetching) violates the executor contract: the orchestrator assumes execution is guaranteed once the step is dispatched. The only valid filter before executing is deduplication via `inFlightRuns` (keyed by `runId`, to avoid running the same run twice concurrently; the key is the run, not the step, because a chain advances the `stepId` between iterations).
- **Auto-chain from `/update-step` response** — `WorkflowPort.updateStepExecution` returns `AvailableRunDispatch | null`: when non-null, the `Runner` executes the next step inline instead of waiting for the next poll. The chain exits on `null` (awaiting-input / finished / error), on a non-progressing `stepIndex` (server bug defense), at `maxChainDepth` (config, default 50), or when `stop()` is called. Each chained step uses the `forestServerToken` from its own dispatch — token freshness is preserved across the chain. The port retries `POST /update-step` on transient failures (network, 5xx) — this relies on server-side idempotency: the orchestrator MUST deduplicate identical outcomes for a given `(runId, stepIndex)` to prevent double side-effects on retry.
- **Pre-recorded AI decisions** — Record step executors support `preRecordedArgs` in the step definition to bypass AI calls. When provided, executors use the pre-recorded **technical names** (`fieldName`/`fieldNames`/`actionName`/`relationName`) directly instead of invoking the AI — the orchestrator→executor wire references fields/relations/actions by their stable technical name, never by the mutable, non-unique `displayName`. The `displayName` persisted in the RunStore is always resolved from the live schema at execution time (still persisted for the AI and for the front — see "displayName in AI tools"). Technical names are matched exactly against the schema (`findFieldByTechnicalName` / the exact action lookup) — the displayName + fuzzy tolerances of `findField` are reserved for AI-returned names, so a technical name can't resolve to a different field whose displayName collides. Each record step type has its own typed `preRecordedArgs` shape. An unresolvable name throws `FieldNotFoundError` / `ActionNotFoundError` / `RelationNotFoundError` (read-record instead throws `NoResolvedFieldsError`, only when *no* field resolves — individual misses are surfaced per-field). Malformed arg shapes — e.g. `fieldName` without `value`, or an out-of-range `selectedRecordStepIndex` — throw `InvalidPreRecordedArgsError`. Partial args are supported: only the provided fields skip AI, the rest still use AI.
- **Dedicated database schema** — `DatabaseStore` namespaces both its table (`workflow_step_executions`) and the umzug migration registry (`SequelizeMeta`) under a dedicated `forest` schema, created idempotently at `init()` (`CREATE SCHEMA IF NOT EXISTS`). This makes a shared database safe: the executor never touches `public`, and its migration registry can't collide with the agent/server's own `sequelize-cli` `SequelizeMeta`. The schema is hardcoded (not configurable) and applied on every dialect with schema support; it's skipped on SQLite (used by the test suite), which emulates schemas as attached databases — `DatabaseStore.schema` returns `undefined` there. Raw SQL goes through the `tableReference` getter (schema-qualified, quoted) and DDL through the `tableId` getter (string or `{ tableName, schema }`).
- **Concurrency-safe migrations** — `DatabaseStore.init()` serializes the migration runner behind a Postgres advisory lock (`withMigrationLock`). On a cold start with N replicas booting together (customer HA, every migration-bearing release), only one instance migrates at a time; the others block, then see the migrations already applied and no-op. Without this they'd run the same pending migrations concurrently — boot crash today, partial/duplicated schema or data on a future non-idempotent migration. The lock is **transaction-scoped** (`pg_advisory_xact_lock`, not session `pg_advisory_lock`): it lives for exactly the transaction a connection pooler keeps pinned and auto-releases on commit/rollback/disconnect, so it is safe behind **RDS Proxy / PgBouncer transaction mode** (the common HA setup) and can never leave a dangling lock. The lock transaction sits idle while the migration runs on other pooled connections, so it first issues `SET LOCAL idle_in_transaction_session_timeout = 0` — otherwise a client-configured timeout could terminate it mid-migration and drop the lock, letting a sibling in. `init()` runs two locked transactions in sequence: the first creates the schema (committed so the second can see it — `umzug` runs on other pooled connections), the second runs `umzug.up()`. Migrations are written **transactional + idempotent** (each `up()` wraps its DDL in a transaction and short-circuits via `tableExists`/similar) so a half-applied or already-applied state never crash-loops boot — the lock guarantees one writer, transactional+idempotent migrations guarantee clean (re)application. Needs `pool.max >= 2` (lock connection + migration connection); the Sequelize default of 5 is fine. Gated on `dialect === 'postgres'` — SQLite (test suite) is single-process and skips locking entirely. The lock key (`MIGRATION_ADVISORY_LOCK_KEY`) is a fixed constant and must never change. A real-Postgres integration test (`database-store.pg.test.ts`, gated on `WORKFLOW_EXECUTOR_TEST_DATABASE_URL`, skipped in CI) covers concurrent `init()`, lock blocking/release, no-leak, and the idle-timeout guard.
- **Graceful shutdown** — `stop()` drains in-flight steps before closing resources. The `state` getter exposes the lifecycle: `idle → running → draining → stopped`. `stopTimeoutMs` (default 30s) prevents `stop()` from hanging forever if a step is stuck. The HTTP server stays up during drain so the frontend can still query run status. Signal handling (`SIGTERM`/`SIGINT`) is the consumer's responsibility — the Runner is a library class.
- **Structured log context** — `BaseStepExecutor.execute()` stamps every log line with a shared `logCtx` (`runId`, `stepId`, `stepIndex`, `stepType`). Executors with type-specific identifiers add them via the `getExtraLogContext()` hook (default `{}`), keeping the base class free of step-specific knowledge — e.g. `McpStepExecutor` returns `{ mcpServerId, mcpServerName }` so MCP step logs unambiguously identify the targeted server (`mcpServerId` is canonical; `mcpServerName` is the human-readable Record key, not guaranteed unique at the DB level). `mcpServerName` is resolved by `RemoteToolFetcher.fetch()` from the scoped config Record key and forwarded to the executor constructor.
- **Revision-aware history reads** — On revision the orchestrator (server-side) marks the pivot card `revised` and every later entry `cancelled`, then appends clones of the still-valid steps (each clone's `originalStepIndex` points at the step it copies) plus a fresh re-execution of the revised step. Any consumer of `workflowHistory` must restrict to the live path (`!revised && !cancelled`) — skipping this leaks a superseded branch's context into a re-run. To find a step's RunStore execution, resolve own `stepIndex` first, then fall back to `originalStepIndex` (a clone the executor never ran inherits the copied step's record — mirrors the frontend's `carryForwardExecutorDataForCopiedSteps`). Own-index-first is essential: a re-executed step has its own entry, so it must never inherit the superseded original's record. Never key on `stepName` — LinkTo loops can put the same name on the live path twice.
- **Logger shape** — `Logger = (level, message, context?) => void` with `LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error'` (signature aligned with `@forestadmin/agent`; the executor extends it with a structured `context` object). Adapters `createConsoleLogger(minLevel)` (JSON) and `createPrettyLogger(minLevel)` (colorized) are factories that close over a min-level filter — calls below the threshold are dropped at the source. CLI minimum level comes from `LOG_LEVEL` env var (default `Info`); library consumers pass `loggerLevel` in `ExecutorOptions`.
- **Boundary validation** — Types that cross a trust boundary (wire from the orchestrator, or mapper output) live under `src/types/validated/` as zod schemas with TS types inferred via `z.infer<>`. Strictness depends on origin: schemas the executor **produces** (mapper output) and **frontend** HTTP bodies use `.strict()` (catch our own bugs / input hygiene); the **orchestrator collection schema** instead **strips** unknown keys and requires only structural fields, with step-specific props optional and asserted at use-time by the consuming executor. This keeps the executor resilient to independent orchestrator drift — we fail at step execution, only when a step genuinely lacks what it needs, never in bulk up front for an unrelated add/remove. Validation runs where data enters (`forest-server-workflow-port.getCollectionSchema`, `run-to-available-step-mapper.toAvailableStepExecution`). On parse failure: throw `DomainValidationError` (extends `WorkflowExecutorError`) → bucketized as malformed (dispatch) or surfaced as a step error (execution). Types outside `validated/` are internal runtime state and not zod-validated. Note: `StepOutcome` is validated when it arrives as input via `previousSteps`; executor outputs are trusted by construction.

## Commands

```bash
yarn workspace @forestadmin/workflow-executor build      # Build
yarn workspace @forestadmin/workflow-executor test       # Run tests
yarn workspace @forestadmin/workflow-executor lint       # Lint
```

## Testing

- Prefer integration tests over unit tests
- Use AAA pattern (Arrange, Act, Assert)
- Test behavior, not implementation
- Strong assertions: verify exact arguments, not just that a function was called
