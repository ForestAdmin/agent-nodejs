import type { ActionEndpointsByCollection } from './schema-fetcher';
import type { ForestServerClient } from '../http-client';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import { fetchForestSchema, getActionEndpoints } from './schema-fetcher';

interface BuildClientOptions {
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  actionEndpoints?: ActionEndpointsByCollection;
}

export type AuthData = {
  userId: number;
  renderingId: number;
  environmentId?: number;
  projectId?: number;
  environmentApiEndpoint: string;
};

function createClient(options: BuildClientOptions) {
  const { request, actionEndpoints = {} } = options;
  const token = request.authInfo?.token;
  const url = request.authInfo?.extra?.environmentApiEndpoint;

  if (!token) {
    throw new Error('Authentication token is missing');
  }

  if (!url || typeof url !== 'string') {
    throw new Error('Environment API endpoint is missing or invalid');
  }

  const rpcClient = createRemoteAgentClient({
    token,
    url,
    actionEndpoints,
  });

  return {
    rpcClient,
    authData: request.authInfo?.extra as AuthData,
  };
}

export default function buildClient(
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
) {
  return createClient({ request });
}

/**
 * Builds a client with action endpoints loaded from the Forest schema.
 * Use this for tools that need to execute actions.
 */
export async function buildClientWithActions(
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
  forestServerClient: ForestServerClient,
) {
  const schema = await fetchForestSchema(forestServerClient);
  const actionEndpoints = getActionEndpoints(schema);

  return createClient({ request, actionEndpoints });
}
