import type { CapabilitiesFetcher } from './capabilities-cache';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

export interface AgentCapabilitiesFetcherOptions {
  agentUrl: string;
  token: string;
}

/**
 * Builds a capabilities fetcher bound to a request's agent token. The cache calls it only on a
 * miss, so the token of whichever request first populates a collection is the one used.
 */
export default function createAgentCapabilitiesFetcher({
  agentUrl,
  token,
}: AgentCapabilitiesFetcherOptions): CapabilitiesFetcher {
  const client = createRemoteAgentClient({ url: agentUrl, token });

  return collection => client.collection(collection).capabilities();
}
