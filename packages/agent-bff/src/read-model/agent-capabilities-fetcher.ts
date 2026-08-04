import type { CapabilitiesFetcher } from './capabilities-cache';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentHttpRequester from '../agent/create-agent-http-requester';

export interface AgentCapabilitiesFetcherOptions {
  agentUrl: string;
  token: string;
  timeoutMs?: number;
}

/**
 * Builds a capabilities fetcher bound to a request's agent token. The cache calls it only on a
 * miss, so the token of whichever request first populates a collection is the one used.
 */
export default function createAgentCapabilitiesFetcher({
  agentUrl,
  token,
  timeoutMs,
}: AgentCapabilitiesFetcherOptions): CapabilitiesFetcher {
  const client = createRemoteAgentClient({
    url: agentUrl,
    token,
    httpRequester: createAgentHttpRequester(token, agentUrl, timeoutMs),
  });

  return collection => client.collection(collection).capabilities();
}
