# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/agent-toolkit` is the lowest-level shared package in the monorepo. It holds the cross-cutting `BusinessError` hierarchy that sibling packages depend on. It deliberately has **zero `@forestadmin/*` dependencies** so that any package can depend on it without creating a cycle.

## Architecture

The package is tiny but load-bearing — its value is in being the single source of truth for things shared across the dependency graph.

- **`src/errors.ts` — `BusinessError` hierarchy.** `BusinessError` plus the HTTP-flavored subclasses (`ValidationError`, `BadRequestError`, `UnprocessableError`, `ForbiddenError`, `NotFoundError`, `UnauthorizedError`, `TooManyRequestsError`, `InternalServerError`). The agent's error middleware maps these to HTTP statuses. `datasource-toolkit/src/errors.ts` **re-exports `BusinessError`/`ValidationError` from here** for backward compatibility and builds its own domain errors on top, so this is the canonical definition — changing it ripples outward.
  - Subclasses set `baseBusinessErrorName` so error type can be detected across mismatched package versions. **Use `BusinessError.isOfType(err, SomeError)` rather than `instanceof`** — `instanceof` is unreliable when two packages resolve to different copies of this module.

- **`src/index.ts`** re-exports the error hierarchy.

## Commands

```bash
yarn workspace @forestadmin/agent-toolkit build      # tsc
yarn workspace @forestadmin/agent-toolkit test       # jest
yarn workspace @forestadmin/agent-toolkit lint       # eslint src test
yarn workspace @forestadmin/agent-toolkit test -- test/errors.test.ts   # single file
yarn workspace @forestadmin/agent-toolkit test -- -t "isOfType"         # single test by name
```
