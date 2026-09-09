import type { CapabilitiesFetcher } from './capabilities-cache';
import type { AgentTransport } from '../agent/agent-transport';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

export interface AgentCapabilitiesFetcherOptions {
  transport: AgentTransport;
  /** A borrowed request token, or a factory when the caller can mint one per fetch. */
  token: string | (() => string);
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
  transport,
  token,
}: AgentCapabilitiesFetcherOptions): CapabilitiesFetcher {
  const clientFor = (bearer: string) =>
    createRemoteAgentClient({
      url: transport.url,
      token: bearer,
      httpRequester: transport.createRequester(bearer),
    });

  if (typeof token === 'string') {
    const client = clientFor(token);

    return collection => client.collection(collection).capabilities();
  }

  return collection => clientFor(token()).collection(collection).capabilities();
}
