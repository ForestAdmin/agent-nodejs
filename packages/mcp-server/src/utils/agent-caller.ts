import type { ActionEndpoints } from './schema-fetcher';
import type { ForestServerClient } from '../http-client';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import { fetchForestSchema, getActionEndpoints } from './schema-fetcher';

interface BuildClientOptions {
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  actionEndpoints?: ActionEndpoints;
}

export type AuthData = {
  userId: number;
  renderingId: number;
  environmentId?: number;
  projectId?: number;
  environmentApiEndpoint: string;
  forestServerToken?: string;
};

function createClient(options: BuildClientOptions) {
  const { request, actionEndpoints = {} } = options;
  const token = request.authInfo?.token;
  const url = request.authInfo?.extra?.environmentApiEndpoint;
  const { forestServerToken, renderingId } = (request.authInfo?.extra ?? {}) as AuthData;

  if (!token) {
    throw new Error('Authentication token is missing');
  }

  if (!url || typeof url !== 'string') {
    throw new Error('Environment API endpoint is missing or invalid');
  }

  const forestServer =
    forestServerToken && renderingId != null
      ? {
          url: process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
          forestServerToken,
          renderingId,
        }
      : undefined;

  const rpcClient = createRemoteAgentClient({
    token,
    url,
    actionEndpoints,
    forestServer,
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
