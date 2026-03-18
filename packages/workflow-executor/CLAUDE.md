# @forestadmin/workflow-executor

> **Note to Claude**: Keep this file up to date. When adding a new feature, module, architectural pattern, or dependency, update the relevant section below.

## Overview

TypeScript library (framework-agnostic) that executes workflow steps on the client's infrastructure, alongside the Forest Admin agent. The orchestrator never sees client data — it only sends step definitions; this package fetches them and runs them locally.

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
│   └── run-store.ts        # Interface for persisting run state
└── index.ts                # Barrel exports
```

## Architecture Principles (Planned)

The following principles will guide implementation. None are implemented yet.

- **Pull-based** — The executor will poll for pending steps via a port interface. A `triggerPoll(runId)` mechanism will fast-track a specific run.
- **Atomic** — Each step will execute in isolation. A run store will maintain continuity between steps.
- **Privacy** — Zero client data leaves the client's infrastructure.
- **Ports (IO injection)** — All external IO will go through injected port interfaces, keeping the core pure and testable.
- **AI integration** — Will use `@forestadmin/ai-proxy` (Router) to create models and load remote tools.

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
