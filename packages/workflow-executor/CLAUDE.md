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
│   │   ├── execution.ts    # PendingStepExecution, StepUser, Step
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
│   ├── database-store.ts   # DatabaseStore — Sequelize + umzug migrations
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

- **Pull-based** — The executor polls for pending steps via a port interface (`WorkflowPort.getPendingStepExecutions`; polling loop not yet implemented).
- **Atomic** — Each step executes in isolation. A run store (scoped per run) maintains continuity between steps.
- **Privacy** — Zero client data leaves the client's infrastructure. `StepOutcome` is sent to the orchestrator and must NEVER contain client data. Privacy-sensitive information (e.g. AI reasoning) must stay in `StepExecutionData` (persisted in the RunStore, client-side only).
- **Ports (IO injection)** — All external IO goes through injected port interfaces, keeping the core pure and testable.
- **AI integration** — Uses `@langchain/core` (`BaseChatModel`, `DynamicStructuredTool`) for AI-powered steps. `ExecutionContext.model` is a `BaseChatModel`.
- **Error hierarchy** — Two families of errors coexist in `src/errors.ts`:
  - **Domain errors** (`extends WorkflowExecutorError`) — Thrown during step execution (e.g. `RecordNotFoundError`, `MissingToolCallError`). Caught by `base-step-executor.ts` and converted into `stepOutcome.error` sent to the orchestrator. All domain errors must extend `WorkflowExecutorError`.
  - **Boundary errors** (`extends Error`) — Thrown outside step execution, at the HTTP or Runner layer (e.g. `RunNotFoundError`, `PendingDataNotFoundError`, `ConfigurationError`). Caught by the HTTP server and translated into HTTP status codes (404, 400, etc.). These intentionally do NOT extend `WorkflowExecutorError` to prevent `base-step-executor` from catching them as step failures.
- **Dual error messages** — `WorkflowExecutorError` carries two messages: `message` (technical, for dev logs) and `userMessage` (human-readable, surfaced to the Forest Admin UI via `stepOutcome.error`). The mapping happens in a single place: `base-step-executor.ts` uses `error.userMessage` when building the error outcome. When adding a new error subclass, always provide a distinct `userMessage` oriented toward end-users (no collection names, field names, or AI internals). If `userMessage` is omitted in the constructor call, it falls back to `message`.
- **displayName in AI tools** — All `DynamicStructuredTool` schemas and system message prompts must use `displayName`, never `fieldName`. `displayName` is a Forest Admin frontend feature that replaces the technical field/relation/action name with a product-oriented label configured by the Forest Admin admin. End users write their workflow prompts using these display names, not the underlying technical names. After an AI tool call returns display names, map them back to `fieldName`/`name` before using them in datasource operations (e.g. filtering record values, calling `getRecord`).
- **Idempotency in mutating executors** — `update-record`, `trigger-action`, and `mcp` executors protect against duplicate side effects via a write-ahead log in the `RunStore`. Before the side effect fires, the executor saves `idempotencyPhase: 'executing'`. After, it saves `idempotencyPhase: 'done'` alongside the normal `executionResult`. On re-dispatch (same `runId + stepIndex`): `done` → reconstruct success outcome via `buildOutcomeResult` without re-executing or emitting an activity log; `executing` → throw `StepStateError` (user retries manually, also no activity log). The `checkIdempotency()` hook in `BaseStepExecutor` is called before `runWithActivityLog()` so neither cache hits nor uncertain-state errors emit activity log entries. Non-mutating executors (`condition`, `read-record`, `guidance`, `load-related-record`) do not override `checkIdempotency()` — replaying them is safe.
- **Fetched steps must be executed** — Any step retrieved from the orchestrator via `getPendingStepExecutions()` must be executed. Silently discarding a fetched step (e.g. filtering it out by `runId` after fetching) violates the executor contract: the orchestrator assumes execution is guaranteed once the step is dispatched. The only valid filter before executing is deduplication via `inFlightRuns` (keyed by `runId`, to avoid running the same run twice concurrently; the key is the run, not the step, because a chain advances the `stepId` between iterations).
- **Auto-chain from `/update-step` response** — `WorkflowPort.updateStepExecution` returns `PendingRunDispatch | null`: when non-null, the `Runner` executes the next step inline instead of waiting for the next poll. The chain exits on `null` (awaiting-input / finished / error), on a non-progressing `stepIndex` (server bug defense), at `maxChainDepth` (config, default 50), or when `stop()` is called. Each chained step uses the `forestServerToken` from its own dispatch — token freshness is preserved across the chain. The port retries `POST /update-step` on transient failures (network, 5xx) — this relies on server-side idempotency: the orchestrator MUST deduplicate identical outcomes for a given `(runId, stepIndex)` to prevent double side-effects on retry.
- **Pre-recorded AI decisions** — Record step executors support `preRecordedArgs` in the step definition to bypass AI calls. When provided, executors use the pre-recorded values (display names) directly instead of invoking the AI. Each record step type has its own typed `preRecordedArgs` shape. Validation happens via schema resolution — invalid display names throw `InvalidPreRecordedArgsError`. Partial args are supported: only the provided fields skip AI, the rest still use AI.
- **Graceful shutdown** — `stop()` drains in-flight steps before closing resources. The `state` getter exposes the lifecycle: `idle → running → draining → stopped`. `stopTimeoutMs` (default 30s) prevents `stop()` from hanging forever if a step is stuck. The HTTP server stays up during drain so the frontend can still query run status. Signal handling (`SIGTERM`/`SIGINT`) is the consumer's responsibility — the Runner is a library class.
- **Boundary validation** — Types that cross a trust boundary (wire from the orchestrator, or mapper output) live under `src/types/validated/` and are declared as zod schemas with TS types inferred via `z.infer<>`. Every schema uses `.strict()` by default. Validation runs at the boundary where the data enters the executor (`forest-server-workflow-port.getCollectionSchema` → `CollectionSchemaSchema.parse`, `run-to-pending-step-mapper.toPendingStepExecution` → `PendingStepExecutionSchema.parse`). On parse failure: throw `DomainValidationError` (extends `WorkflowExecutorError`) → bucketized as malformed → reported to the orchestrator. Types outside `validated/` (`execution-context.ts`, `step-execution-data.ts`) are internal runtime state and are not zod-validated. Note: `StepOutcome` is validated when it arrives as input via `previousSteps`; outputs produced by executors are trusted by construction.

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
