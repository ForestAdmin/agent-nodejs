---
status: accepted
date: 2026-11-23
tags: [agent-client, activity-log, audit]
affected_components: [agent-client, agent-bff, mcp-server, workflow-executor]
---

# Activity logging lives inside agent-client, and every surface only passes its context

The Gateway, the MCP server and the workflow executor each kept their own copy of the audit rules, and the copies drifted: an approval request was logged as an executed action. agent-client now writes the activity log inside its own methods (reads, writes, relations, actions), off unless the consumer passes its Forest server connection and an `activityLog` source, with one fail policy: the pending entry is created before the call, a write whose entry cannot be created does not run, a read runs with an error log, and the status is set afterwards without delaying the answer (PRD-2397, ForestAdmin/agent-nodejs#2106). Rejected: each surface declaring its operations to agent-client, which keeps the Gateway's hand-built reads but leaves one logging call per operation in every surface, the drift this removes. Accepted cost: a published RPC client now talks to the Forest server's audit routes, the consumers bump agent-client together, and the two differences left between surfaces, the workflow executor retrying the creation and the Gateway letting a read run on an expired audit credential, are settings rather than code.
