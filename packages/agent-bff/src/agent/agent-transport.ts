import type { HttpRequester } from '@forestadmin/agent-client';

import createAgentHttpRequester from './create-agent-http-requester';

/**
 * How the BFF reaches the agent. Everything that talks to the agent takes one of these instead of a
 * URL, so the same routes serve a remote agent over HTTP and an agent embedded in the same process.
 */
export interface AgentTransport {
  /**
   * Base url `createRemoteAgentClient` still requires. Over HTTP it is the agent; in-process it is a
   * sentinel that never reaches the network, since the requester answers before any socket is opened.
   */
  url: string;
  createRequester(token: string): HttpRequester;
}

export interface HttpTransportOptions {
  agentUrl: string;
  timeoutMs?: number;
}

export function createHttpTransport({ agentUrl, timeoutMs }: HttpTransportOptions): AgentTransport {
  return {
    url: agentUrl,
    createRequester: token => createAgentHttpRequester(token, agentUrl, timeoutMs),
  };
}
