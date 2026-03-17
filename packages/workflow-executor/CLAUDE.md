# @forestadmin/workflow-executor

> **Note to Claude**: Keep this file up to date. When adding a new feature, module, architectural pattern, or dependency, update the relevant section below.

## Overview

TypeScript library (framework-agnostic) that executes workflow steps on the client's infrastructure, alongside the Forest Admin agent. The orchestrator never sees client data — it only sends step definitions; this package fetches them and runs them locally.

## Architecture Principles

- **Pull-based** — The executor polls for pending steps via `WorkflowPort`. `triggerPoll(runId)` fast-tracks a specific run.
- **Atomic** — Each step is executed in isolation. `RunStore` maintains continuity between steps.
- **Privacy** — Zero client data leaves the client's infrastructure. All data lives in `RunStore`.
- **Ports (IO injection)** — Every external IO goes through an injected port interface, making the core pure and testable.
- **AI integration** — Uses `@forestadmin/ai-proxy` (Router) to create models and load remote tools.

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
