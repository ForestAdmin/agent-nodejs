# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@forestadmin/ai-proxy` is the AI/LLM integration layer of the monorepo. It implements the AI-provider contract owned by `@forestadmin/agent-toolkit` (`AiProviderDefinition` / `AiRouter` from `interfaces/ai.ts`) and is consumed by `@forestadmin/agent` (which mounts it on its `ai-proxy` route), plus `forestadmin-client` and `workflow-executor`. It is a thin pass-through proxy in front of LangChain: it speaks the OpenAI Chat Completions wire format to the frontend, dispatches to OpenAI or Anthropic, and exposes "remote tools" (MCP servers + first-party Forest integrations) for tool-calling.

## Architecture

`createAiProvider(config)` (`create-ai-provider.ts`) is the public entry point: it returns an `AiProviderDefinition` whose `init(logger)` builds a `Router` and exposes a single `route(args)`. Everything funnels through **`Router.route`** (`router.ts`), which Zod-validates the request against a discriminated union on `route` (`schemas/route.ts`) — three routes:

- **`ai-query`** — pick an `AiConfiguration` (by `ai-name`, falling back to the first config with a warning), build a `ProviderDispatcher`, and dispatch the chat completion.
- **`invoke-remote-tool`** — execute one tool by sanitized name (+ optional `source-id` to disambiguate).
- **`remote-tools`** — return tool definitions (JSON-schema) for the frontend.

**Provider dispatch** (`provider-dispatcher.ts`): constructs a `ChatOpenAI` or `ChatAnthropic` (LangChain) from the config. OpenAI's raw response is plucked from `additional_kwargs.__raw_response` (requires `__includeRawResponse: true`); Anthropic responses are converted back to OpenAI shape via `LangChainAdapter`/`AnthropicAdapter`. The OpenAI Chat Completions format is the canonical wire format on both ends. Provider SDK errors are normalized to the AI error classes by `wrapProviderError` (maps HTTP 400/401/403/429/5xx).

**Tool providers** (`tool-provider.ts` interface: `loadTools` / `checkConnection` / `dispose`): `createToolProviders` (`tool-provider-factory.ts`) splits the per-request `toolConfigs` map into two `ToolProvider`s — `McpClient` (`mcp-client.ts`, wraps `@langchain/mcp-adapters`, one `MultiServerMCPClient` per server for fault isolation) and `ForestIntegrationClient` (`forest-integration-client.ts`, dispatches `integrationName` → Zendesk / Kolar / Snowflake tool sets under `integrations/`). The two are distinguished by the `isForestConnector: true` flag. Loaded tools are wrapped as `RemoteTool` subclasses and collected into `RemoteTools`. Providers are created per-request and `dispose()`d in a `finally`.

`createBaseChatModel` (`create-base-chat-model.ts`) is a separate, lighter export returning a raw LangChain `BaseChatModel` for callers that want direct model access without the proxy/tool machinery.

## Commands

```bash
yarn workspace @forestadmin/ai-proxy build   # tsc
yarn workspace @forestadmin/ai-proxy lint
yarn workspace @forestadmin/ai-proxy test
# single test file or by name:
yarn workspace @forestadmin/ai-proxy test -- provider-dispatcher.test.ts
yarn workspace @forestadmin/ai-proxy test -- -t "falls back to first configuration"
```

## Gotchas

- **Never `throw new Error(...)`.** All thrown errors must extend an AI error class from `src/errors.ts`, which extend the `BusinessError` hierarchy (`BadRequestError`, `UnprocessableError`, …) from `@forestadmin/agent-toolkit`. The agent and the Forest server both map these to HTTP status codes via their error middleware; a bare `Error` becomes a generic 500.
- **Passthrough, not a retrying client:** dispatcher models are built with `maxRetries: 0` deliberately. Provider errors are surfaced, not retried.
- **`supported-models.ts` is a maintained allow/deny list, not a capability probe.** `Router` rejects configs whose model fails `isModelSupportingTools` at construction. When a model fails the `llm.integration` test, add its prefix/pattern/exact-id to the unsupported lists (e.g. Anthropic models that require streaming time out on non-streaming and are denylisted).
- **Tool names are sanitized** (`RemoteTool.sanitizedName`: non-`[A-Za-z0-9_-]` → `_`) to satisfy OpenAI function-name rules; always match/invoke tools by `sanitizedName`, not the raw tool name. Duplicate sanitized names across sources require a `source-id` to disambiguate.
- **`createLocalToolProviders()` is intentionally empty** (Brave Search was removed); the `localToolsApiKeys` constructor param is kept only for API stability and future local tools.
