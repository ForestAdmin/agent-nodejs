# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/mcp-server` is a Model Context Protocol (MCP) server that exposes Forest Admin data operations (list, CRUD, relations, custom actions) to AI assistants over an OAuth-authenticated, streamable HTTP transport. It runs either standalone (`forest-mcp-server` CLI) or embedded in a Forest Admin agent via `agent.mountAiMcpServer()`.

## Architecture

`ForestMCPServer` (`src/server.ts`) is the entry point and the only stateful object. `buildExpressApp()` wires an Express app with: CORS, OAuth metadata discovery (`/.well-known/oauth-protected-resource/mcp`), OAuth handlers (`/oauth/authorize`, `/oauth/token`), and the bearer-protected `POST /mcp`. `run()` listens standalone; `getHttpCallback()` returns a middleware so an agent can mount the MCP routes inside its own (often Koa) HTTP server — see `isMcpRoute` in `src/mcp-paths.ts` for the route prefixes it claims.

Key flows that only make sense across files:

- **Per-request MCP server.** `handleMcpRequest` builds a *fresh* `McpServer` + `StreamableHTTPServerTransport` per request (`sessionIdGenerator: undefined`, stateless) and closes the transport on response end. Tool registration in `createMcpServer()` therefore re-runs on every call.
- **OAuth = pass-through to Forest Admin.** `ForestOAuthProvider` (`src/forest-oauth-provider.ts`) does not store tokens. `/oauth/authorize` redirects to the Forest app; `exchange*` calls relay to the Forest server's `/oauth/token`, then `generateAccessToken` re-signs a JWT with `authSecret` carrying the Forest token under the `serverToken` claim. `verifyAccessToken` verifies that JWT and builds `AuthInfo.extra` with `forestServerToken: decoded.serverToken` plus `environmentApiEndpoint` — the latter is **not** in the JWT, it's read from the provider's own `this.environmentApiEndpoint` field (set during env discovery).
- **Tools call the live agent, not this server.** Each tool in `src/tools/*` is a `declareXxxTool(mcpServer, forestServerClient, logger, collectionNames)` factory. At call time `buildClient(extra)` (`src/utils/agent-caller.ts`) reads `extra.authInfo` (`forestServerToken` + `environmentApiEndpoint` from `AuthInfo.extra`) and builds a `createRemoteAgentClient` from `@forestadmin/agent-client` — i.e. the tool RPCs into the user's actual running agent. `forestServerClient` (`src/http-client`, wrapping `@forestadmin/forestadmin-client`'s `SchemaService`/`ActivityLogsService`) is used only for schema fetch and activity logging, not data.
- **Two cross-cutting wrappers, always used together.** `registerToolWithLogging` (`src/utils/tool-with-logging.ts`) registers the tool and converts thrown errors into `{ isError: true }` results (per MCP spec) instead of protocol errors. Inside the handler, `withActivityLog` (`src/utils/with-activity-log.ts`) brackets the operation with a pending→succeeded/failed Forest activity log and runs `parseAgentError` + optional `errorEnhancer` (e.g. `list` appends sortable field names on "Invalid sort").
- **`collectionNames` → `z.enum`.** `fetchCollectionNames()` populates the schema's collection list; tools turn it into a `z.enum` for `collectionName` so the LLM gets autocomplete/validation. If schema fetch fails the server logs a warning and runs "degraded" with `z.string()`.

## Commands

```bash
yarn workspace @forestadmin/mcp-server build
yarn workspace @forestadmin/mcp-server test
yarn workspace @forestadmin/mcp-server lint
# single test — tests are NOT colocated; they live under test/ mirroring src/ (jest testMatch: <rootDir>/test/**/*.test.ts)
yarn workspace @forestadmin/mcp-server test -- test/tools/list.test.ts
yarn workspace @forestadmin/mcp-server test -- -t "Invalid sort"
# run standalone (loads .env): needs FOREST_ENV_SECRET + FOREST_AUTH_SECRET
yarn workspace @forestadmin/mcp-server start:dev
```

## Gotchas

- **`src/polyfills.ts` must be the first import in `server.ts`** (it shims `URL.canParse` before the MCP SDK's Zod schemas load). Don't reorder imports above it.
- **`@modelcontextprotocol/sdk` is imported with explicit `.js` paths** (e.g. `.../server/mcp.js`) — the package is ESM-only and TS won't resolve these without the extension.
- **Adding a tool requires three coordinated edits in `server.ts`**: the `ToolName` union, the `allTools` array in `createMcpServer()`, and the `allToolNames` list in `resolveEnabledTools()`. A new tool is opt-out only if also added to those lists; `enabledTools` is a strict allowlist and **`describeCollection` is always force-enabled**.
- **Only fields in `SAFE_ARGUMENTS_FOR_LOGGING` are logged** for a tool call — `search`/`filters`/record bodies are deliberately omitted to avoid leaking data. Add a tool's safe field list there when you add a tool.
- **`getHttpCallback` reaches into `req._readableState`** to repair `pipes` when the request stream was already consumed by a host framework (Koa). This is load-bearing for the embedded/agent mount path; don't remove it.
- `filters` accepts a JSON *string* (LLMs often send one) via a `z.preprocess` in `src/tools/list.ts`; relation filtering uses `:` and field selection uses `@@@` as separators — encoded in the tool descriptions the LLM reads.
