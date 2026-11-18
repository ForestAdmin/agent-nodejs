---
status: accepted
date: 2026-11-18
supersedes: 2026-09-15-bedrock-is-executor-only-and-its-models-pass-an-allowlist
tags: [ai-plane, workflow-executor, gateway]
affected_components: [ai-proxy, workflow-executor, agent-bff, agent]
---

# Bedrock is reached only through AiClient, by the runtime and the Gateway API, and its models pass an allowlist

`AI_PROVIDER=bedrock` reaches an LLM only through ai-proxy's `AiClient`, which the runtime and now the Gateway API use, while the server-side `Router` still refuses it because that surface is being retired. The Gateway answers `POST /agent/v1/ai/query` with its own `BFF_AI_*` setting (embedded `addGateway({ api: { ai } })`), else the runtime's `AI_*` (embedded `addWorkflowExecutor({ ai })`), else it relays to Forest's AI server, and a provider failure never falls back to Forest, so ticket content never reaches Forest for a customer who chose otherwise. Bedrock model ids still pass the Claude allowlist, checked at boot in both components, because the runtime forces a tool call on every AI step. Accepted cost: any Forest user of the project holding a Gateway session can send free-form prompts to the customer's model, bounded only by the per-identity rate limit; with no tools and no data access this is spend on the customer's account outside Forest's usage tracking, the same shape as the relay. Bedrock runs under the host's AWS credential chain, which the operator scopes to `bedrock:InvokeModel`. Calling OpenAI and Anthropic directly without ai-proxy was turned down because it drops Bedrock, and reading the runtime's setting first because it would ignore the Gateway's own.
