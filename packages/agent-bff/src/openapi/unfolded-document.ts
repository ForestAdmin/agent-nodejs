import type { Unfolding } from './unfolding';
import type { Logger } from '../ports/logger-port';
import type ReadModel from '../read-model/read-model';
import type ReadModelStore from '../read-model/read-model-store';

import collectUnfolding from './collect-unfolding';
import { generateOpenApiDocument, serializeOpenApi } from './openapi-document';
import { issueAgentToken } from '../api-key/agent-token';
import createAgentCapabilitiesFetcher from '../read-model/agent-capabilities-fetcher';

/** Everything needed to unfold. Absent when the deployment cannot reach its schema or its agent. */
export interface UnfoldSource {
  store: ReadModelStore;
  agentUrl: string;
  timeoutMs?: number;
  logger: Logger;
}

export interface UnfoldedDocument {
  document: string;
  /** Handed back so a caller can react to a collection that went out without its field set. */
  unfolding: Unfolding;
}

export default async function buildUnfoldedDocument(
  source: UnfoldSource,
  readModel: ReadModel,
  token: string | (() => string),
  version: string,
): Promise<UnfoldedDocument> {
  const unfolding = await collectUnfolding({
    readModel,
    store: source.store,
    capabilitiesFetcher: createAgentCapabilitiesFetcher({
      agentUrl: source.agentUrl,
      token,
      timeoutMs: source.timeoutMs,
    }),
    logger: source.logger,
  });

  return { document: serializeOpenApi(generateOpenApiDocument(version, unfolding)), unfolding };
}

/**
 * The CLI has no caller to borrow an agent token from, so it signs its own with the deployment's
 * auth secret — the only thing the agent verifies, and the capabilities route it calls runs no
 * permission check. The identity is inert on purpose: it is never used to read or write records.
 *
 * Minted per capabilities call rather than once: an agent token lives 5 minutes
 * (`AGENT_TOKEN_EXPIRES_IN`) and a fan-out over hundreds of collections against a slow agent can
 * outlive that, which would degrade the tail of the document for no reason.
 */
export function issueOpenApiAgentToken(authSecret: string): string {
  return issueAgentToken({
    authSecret,
    identity: {
      renderingId: 0,
      allowedOrigins: [],
      user: {
        id: 0,
        email: 'openapi@agent-bff.forestadmin.com',
        firstName: 'Forest',
        lastName: 'BFF',
        team: 'Operations',
        tags: [],
        permissionLevel: 'admin',
      },
    },
  });
}
