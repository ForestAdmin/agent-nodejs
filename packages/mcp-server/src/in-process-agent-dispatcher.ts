// Structural contract satisfied by the agent's InProcessDispatcher. Declared here (not imported
// from @forestadmin/agent) to avoid a dependency cycle — agent already depends on mcp-server.
export interface InProcessAgentDispatcher {
  request(request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    query?: Record<string, unknown>;
    payload?: unknown;
    timeoutMs?: number;
  }): Promise<{ status: number; body: unknown; text: string }>;
}
