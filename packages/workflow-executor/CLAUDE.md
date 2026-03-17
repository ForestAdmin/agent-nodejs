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
Front  ──▶  Orchestrator  ◀──pull──  Executor  ──▶  Agent (datasources)
  ▲                                      │
  └──────────── progress/results ────────┘
```

## Package Structure

```
src/
├── types/                  # Core type definitions (@draft)
│   ├── step-definition.ts  # StepType enum + step definition interfaces
│   ├── step-history.ts     # Step outcome tracking types
│   ├── step-execution-data.ts # Runtime state for in-progress steps
│   ├── record.ts           # Record references and data types
│   └── execution.ts        # Top-level execution types (context, results)
├── ports/                  # IO boundary interfaces (@draft)
│   ├── agent-port.ts       # Interface to the Forest Admin agent (datasource)
│   ├── workflow-port.ts    # Interface to the orchestrator
│   └── run-store.ts        # Interface for persisting run state (scoped to a run)
├── executors/              # Step executor implementations
│   └── condition-step-executor.ts  # AI-powered condition step (chooses among options)
├── utils/
│   ├── build-additional-context.ts # Builds text summary of previous steps for AI prompt
│   └── extract-tool-call-args.ts   # Extracts single tool call args from AI response
└── index.ts                # Barrel exports
```

## Architecture Principles

- **Pull-based** — The executor polls for pending steps via a port interface. A `triggerPoll(runId)` mechanism will fast-track a specific run.
- **Atomic** — Each step executes in isolation. A run store (scoped per run) maintains continuity between steps.
- **Privacy** — Zero client data leaves the client's infrastructure. `StepHistory` is sent to the orchestrator and must NEVER contain client data. Privacy-sensitive information (e.g. AI reasoning) must stay in `StepExecutionData` (persisted in the RunStore, client-side only).
- **Ports (IO injection)** — All external IO goes through injected port interfaces, keeping the core pure and testable.
- **AI integration** — Uses `@langchain/core` (`BaseChatModel`, `DynamicStructuredTool`) for AI-powered steps. `ExecutionContext.model` is a `BaseChatModel`.
- **No recovery/retry** — Once the executor returns a step result to the orchestrator, the step is considered executed. There is no mechanism to re-dispatch a step, so executors must NOT include recovery checks (e.g. checking the RunStore for cached results before executing). Each step executes exactly once.

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
