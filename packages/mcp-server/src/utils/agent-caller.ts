import type { ActionEndpoints } from './schema-fetcher';
import type { ToolContext } from '../tool-context';
import type { ActivityLogContext } from '@forestadmin/agent-client';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import getAuthContext from './auth-context';
import InProcessHttpRequester from '../in-process-http-requester';
import { fetchForestSchema, getActionEndpoints } from './schema-fetcher';

type McpRequest = RequestHandlerExtra<ServerRequest, ServerNotification>;
type ClientToolContext = Pick<ToolContext, 'forestServerClient' | 'logger' | 'agentDispatcher'>;

interface BuildClientOptions {
  request: McpRequest;
  ctx: ClientToolContext;
  actionEndpoints?: ActionEndpoints;
  forestServerUrl?: string;
}

export type AuthData = {
  userId: number;
  renderingId: number;
  environmentId?: number;
  projectId?: number;
  environmentApiEndpoint: string;
  forestServerToken?: string;
};

export function activityLogContextOf(
  request: McpRequest,
  { forestServerClient, logger }: Pick<ToolContext, 'forestServerClient' | 'logger'>,
): ActivityLogContext {
  return { service: forestServerClient, credentials: () => getAuthContext(request), logger };
}

function createClient(options: BuildClientOptions) {
  const { request, ctx, actionEndpoints = {}, forestServerUrl } = options;
  const { agentDispatcher } = ctx;
  const token = request.authInfo?.token;
  const url = request.authInfo?.extra?.environmentApiEndpoint;

  if (!token) {
    throw new Error('Authentication token is missing');
  }

  const { forestServerToken, renderingId } = getAuthContext(request);

  const httpRequester = agentDispatcher
    ? new InProcessHttpRequester(token, agentDispatcher)
    : undefined;

  if (!httpRequester && (!url || typeof url !== 'string')) {
    throw new Error('Environment API endpoint is missing or invalid');
  }

  const forestServer = forestServerUrl
    ? { serverUrl: forestServerUrl, serverToken: forestServerToken, renderingId }
    : undefined;

  const rpcClient = createRemoteAgentClient({
    token,
    url: (url as string) ?? '',
    actionEndpoints,
    forestServer,
    httpRequester,
    activityLog: activityLogContextOf(request, ctx),
  });

  return {
    rpcClient,
    authData: request.authInfo?.extra as AuthData,
  };
}

export default function buildClient(request: McpRequest, ctx: ClientToolContext) {
  return createClient({ request, ctx });
}

/**
 * Builds a client with action endpoints loaded from the Forest schema.
 * Use this for tools that need to execute actions.
 */
export async function buildClientWithActions(request: McpRequest, ctx: ClientToolContext) {
  const schema = await fetchForestSchema(ctx.forestServerClient);
  const actionEndpoints = getActionEndpoints(schema);

  return createClient({
    request,
    ctx,
    actionEndpoints,
    forestServerUrl: ctx.forestServerClient.forestServerUrl,
  });
}
