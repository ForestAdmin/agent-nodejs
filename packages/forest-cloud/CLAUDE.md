# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/forest-cloud` is the `forest-cloud` CLI used to bootstrap, develop locally, and publish code customizations for Forest Admin **Cloud** projects (as opposed to self-hosted agents). It is installed as a dev-dependency of the generated `cloud-customizer` project, and ships the `Agent` type that cloud customization code is written against.

## Architecture

This is a CLI, not a library — the only public export (`index.ts`) is the cloud-flavored `Agent` type (a restricted subset of `@forestadmin/datasource-customizer`'s agent: `customizeCollection` / `removeCollection` / `addChart` / `use`, but **no** `addDataSource`) plus the SQL/Mongo connection-param types.

Control flow is layered for testability:

- `command.ts` — the `bin` entry (`#!/usr/bin/env node`). Loads dotenv and calls `buildCommands().parseAsync()`. Marked `istanbul ignore`.
- `build-commands.ts` — composition root. Wires the real implementations (logger, login, env vars, HTTP server, event subscriber, path managers) into the `MakeCommands` context object.
- `make-commands.ts` — builds the Commander `program` from that context and registers each subcommand. **A fresh `Command` instance is created every call on purpose** (tests depend on it).
- `commands/*.ts` — one `make<Name>Command(program, context)` per CLI verb (`bootstrap`, `login`, `logs`, `package`, `publish`, `start`, `update-typings`, `version`). They parse options and orchestrate services.
- `services/*.ts` — the actual work (packaging, publishing, typings generation, running the agent locally, HTTP/WS communication).
- `dialogs/*.ts` — interactive prompts and the shared `actionRunner` wrapper.

Key dependency-injection seam: everything a command needs arrives via the `MakeCommands` context type (`types.ts`). When adding/altering behavior, thread it through that context rather than importing singletons inside commands — that is what keeps commands unit-testable.

**Publish flow** (`commands/publish.ts` → `services/publish.ts`): zip the built `dist/code-customizations` (`services/packager.ts`), request a pre-signed upload (`HttpServer.postUploadRequest`), POST the form to object storage, call `postPublish`, then open a WebSocket via `EventSubscriber` to stream deployment progress until success/error.

**Local `start` flow** (`services/starting-agent-locally.ts`): builds a real `@forestadmin/agent`, reads a user-provided `datasources.js`, and attaches SQL or Mongo datasources by sniffing the connection string protocol (`mongodb`/`mongodb+srv` → `createMongoDataSource`, else `createSqlDataSource`), then `require`s and runs the customization entry point (`services/load-customization.ts`).

`DistPathManager` / `BootstrapPathManager` centralize every filesystem path (zip, typings, built code, the `datasources.js`, and `~/.forest.d/.environments.json`). Do not hardcode these paths elsewhere — go through the managers.

## Commands

```bash
yarn workspace @forestadmin/forest-cloud build    # tsc + copy src/templates to dist
yarn workspace @forestadmin/forest-cloud lint
yarn workspace @forestadmin/forest-cloud test
yarn workspace @forestadmin/forest-cloud test -- services/publish   # single file (regex vs test/ path)
yarn workspace @forestadmin/forest-cloud test -- -t "publish"       # by test name
```

Tests live under `test/` (Jest `testMatch` is `<rootDir>/test/**/*.test.ts`, suffixes `.test.ts` / `.unit.test.ts` / `.integration.test.ts`). The trailing positional is a regex matched against the full test-file path, so use `services/publish` (or `publish`) — a `src/...` pattern never matches and yields "No tests found".

## Gotchas

- **`build` is not just `tsc`.** `build:copy` copies `src/templates/*.txt` (the `env.txt` / `index.txt` scaffolds used by `bootstrap`) into `dist`. Run the full `build` script; a bare `tsc` produces a broken package.
- **Errors must be `BusinessError` (or `CustomizationError`).** `actionRunner` (`dialogs/action-runner.ts`) treats a `BusinessError` as an expected, user-facing failure (prints message, sets `process.exitCode = 1`); anything else is rethrown as an "unexpected error". Throw `BusinessError` for handled failures so the CLI exits cleanly when commands are chained.
- The bundled `Agent` type deliberately omits `addDataSource` — datasources are configured by the cloud platform / local `datasources.js`, not in customization code. Keep `types.ts` in sync with the customizer agent surface that cloud actually supports.
- Depends on a pinned `forest-cli` and several `@forestadmin/datasource-*` packages at exact versions; treat those as a coupled set.
