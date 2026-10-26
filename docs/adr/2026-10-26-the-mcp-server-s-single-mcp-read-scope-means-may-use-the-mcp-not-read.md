---
status: accepted
date: 2026-10-26
tags: [ai-plane, oauth, mcp-server]
affected_components: [mcp-server]
---

# The MCP server's single `mcp:read` scope means "may use the MCP", not read-only

The MCP server advertises, requests and checks one scope, `mcp:read`, and it means "may use the MCP": what a user reads, writes or executes through it stays decided by their Forest permissions, which the agent applies on every tool call. Scopes gate no permission because the user never chooses them: the MCP client asks for them and Forest's consent screen shows only a team. The name is what remains of a four-scope design (`mcp:read`, `mcp:write`, `mcp:action`, `mcp:admin`) that was never wired: every agent JWT carried read, write and action through a fallback, since Forest keeps the granted scope under `meta.scope`, and the gap between the scopes advertised and those granted is what made `mcp-remote` refreshes fail (PRD-1798, PRD-1799, ForestAdmin/forestadmin-server#8668, after #1955). Rejected: renaming it to a neutral `mcp`, because deployed agents advertise and require `mcp:read` and the grants Forest stores carry it, so the server would accept both names for the life of every old agent. Accepted cost: the name reads as read-only, so the docs say otherwise, and adding `mcp:write` back would gate nothing.
