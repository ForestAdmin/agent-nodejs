import type { AgentDispatcher } from '@forestadmin/agent-client';

/**
 * How the BFF reaches the agent. Everything that talks to the agent takes one of these instead of a
 * URL, so the same routes serve a remote agent over HTTP and an agent embedded in the same process.
 */
export interface AgentTransport {
  url: string;
  dispatcher?: AgentDispatcher;
  timeoutMs?: number;
}

export interface HttpTransportOptions {
  agentUrl: string;
  timeoutMs?: number;
}

export function createHttpTransport({ agentUrl, timeoutMs }: HttpTransportOptions): AgentTransport {
  return { url: agentUrl, timeoutMs };
}
