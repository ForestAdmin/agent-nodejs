// Structural contract satisfied by the agent's InProcessDispatcher. Declared here (not imported
// from @forestadmin/agent) to avoid a dependency cycle — agent already depends on mcp-server.
// The agent imports these request/response types rather than re-declaring their shape.
export type InProcessDispatchRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: unknown;
  timeoutMs?: number;
};

// Superagent-shaped so agent-client's HttpRequester parse helpers read it identically.
export type InProcessDispatchResponse = { status: number; body: unknown; text: string };

export interface InProcessAgentDispatcher {
  request(request: InProcessDispatchRequest): Promise<InProcessDispatchResponse>;
}
