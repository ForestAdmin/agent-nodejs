---
status: accepted
date: 2026-09-15
tags: [ai-plane, workflow-executor]
affected_components: [ai-proxy, workflow-executor]
---

# Bedrock is executor-only, and its models pass an allowlist

`AI_PROVIDER=bedrock` reaches an LLM only through the executor's own `AiClient`; the server-side AI proxy's `Router` refuses it at construction, because the server-side provider choice is being retired — the SaaS will serve OpenAI only and any customisation will go through the embedded executor, so wiring Bedrock into `ProviderDispatcher` would build on a surface we are removing. Its model ids are checked against an allowlist of the Claude sonnet, haiku and opus lines, inverting the denylists `openai` and `anthropic` use, because Bedrock resells hundreds of models we do not own while the executor forces a tool call on every AI step: `amazon.titan-text-express-v1` passed the permissive filter without being able to honour one, which surfaces as a failure mid-run rather than a refusal at startup. Accepted cost: a new Claude line needs an allowlist entry before a customer can use it, and the same `AiConfiguration` union is therefore served by one surface and refused by the other.
