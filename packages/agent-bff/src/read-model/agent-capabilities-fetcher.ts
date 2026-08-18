import type { CapabilitiesFetcher } from './capabilities-cache';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentHttpRequester from '../agent/create-agent-http-requester';

export interface AgentCapabilitiesFetcherOptions {
  agentUrl: string;
  /** A borrowed request token, or a factory when the caller can mint one per fetch. */
  token: string | (() => string);
  timeoutMs?: number;
}

/**
 * Builds a capabilities fetcher bound to an agent token. The cache calls it only on a miss, so the
 * token of whichever request first populates a collection is the one used.
 *
 * A factory exists for the token because an agent token lives 5 minutes: a caller fanning out over
 * hundreds of collections can outlive a single one, and the tail of that fan-out would fail on an
 * expired token. A request can only borrow its caller's, so it passes the string.
 */
export default function createAgentCapabilitiesFetcher({
  agentUrl,
  token,
  timeoutMs,
}: AgentCapabilitiesFetcherOptions): CapabilitiesFetcher {
  const clientFor = (bearer: string) =>
    createRemoteAgentClient({
      url: agentUrl,
      token: bearer,
      httpRequester: createAgentHttpRequester(bearer, agentUrl, timeoutMs),
    });

  if (typeof token === 'string') {
    const client = clientFor(token);

    return collection => client.collection(collection).capabilities();
  }

  return collection => clientFor(token()).collection(collection).capabilities();
}
