import type { CapabilitiesFetcher } from './capabilities-cache';
import type ReadModelStore from './read-model-store';
import type { AgentTransport } from '../agent/agent-transport';
import type { Logger } from '../ports/logger-port';

import { AgentHttpError, createRemoteAgentClient } from '@forestadmin/agent-client';

import synthesizeCapabilities, { LEGACY_LIANAS } from './synthesize-capabilities';

export interface AgentCapabilitiesFetcherOptions {
  transport: AgentTransport;
  /** A borrowed request token, or a factory when the caller can mint one per fetch. */
  token: string | (() => string);
  /** Holds the schema snapshot a 404 is answered from when a legacy liana published it. */
  store: ReadModelStore;
  logger: Logger;
}

type LegacyDeps = Pick<AgentCapabilitiesFetcherOptions, 'transport' | 'store' | 'logger'>;

/**
 * The capabilities a legacy liana cannot serve, synthesized from the schema it published, or null
 * when this agent is not one — a proxy blocking `/forest/_internal` answers 404 just the same, so
 * the liana name decides, not the status.
 */
async function synthesizeForLegacyLiana(
  collection: string,
  { transport, store, logger }: LegacyDeps,
): Promise<ReturnType<typeof synthesizeCapabilities> | null> {
  const { collections, meta } = await store.getSchemaSnapshot();
  const schema = collections.find(entry => entry.name === collection);

  if (!schema) return null;

  if (!meta.liana || !LEGACY_LIANAS.has(meta.liana)) {
    logger('Error', 'Agent serves no capabilities route, and its liana is not a legacy one', {
      agentUrl: transport.url,
      collection,
      liana: meta.liana ?? 'absent from the published schema',
      lianaVersion: meta.liana_version ?? 'unknown',
      causes: 'a proxy blocking /forest/_internal, or a collection the agent no longer serves',
    });

    return null;
  }

  logger('Warn', 'Legacy liana: synthesizing the capabilities from the apimap', {
    agentUrl: transport.url,
    collection,
    liana: meta.liana,
    lianaVersion: meta.liana_version ?? 'unknown',
  });

  return synthesizeCapabilities(schema, logger);
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
  store,
  logger,
}: AgentCapabilitiesFetcherOptions): CapabilitiesFetcher {
  const clientFor = (bearer: string) =>
    createRemoteAgentClient({
      url: transport.url,
      token: bearer,
      httpRequester: transport.createRequester(bearer),
    });

  // A borrowed token cannot be renewed, so its client is built once; a factory mints one per fetch.
  function createFetch(): CapabilitiesFetcher {
    if (typeof token === 'string') {
      const client = clientFor(token);

      return collection => client.collection(collection).capabilities();
    }

    return collection => clientFor(token()).collection(collection).capabilities();
  }

  const fetch = createFetch();

  // The liana is read from the cached snapshot, so it lags a migration by at most a schema
  // generation; the synthesis is returned like a normal result, letting the cache stop the doomed
  // POST from repeating on every constrained request.
  return async (collection: string) => {
    try {
      return await fetch(collection);
    } catch (error) {
      if (!(error instanceof AgentHttpError) || error.status !== 404) throw error;

      const synthesized = await synthesizeForLegacyLiana(collection, { transport, store, logger });

      if (!synthesized) throw error;

      return synthesized;
    }
  };
}
