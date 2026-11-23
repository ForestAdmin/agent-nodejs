import type { ActionEndpoints } from './schema-fetcher';
import type { ToolContext } from '../tool-context';
import type { ActivityLogConfig } from '@forestadmin/agent-client';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { ActivityLogSource, createRemoteAgentClient } from '@forestadmin/agent-client';

import getAuthContext from './auth-context';
import InProcessHttpRequester from '../in-process-http-requester';
import { fetchForestSchema, getActionEndpoints } from './schema-fetcher';

type McpRequest = RequestHandlerExtra<ServerRequest, ServerNotification>;
type ClientToolContext = Pick<ToolContext, 'forestServerClient' | 'logger' | 'agentDispatcher'>;

interface BuildClientOptions {
  request: McpRequest;
  ctx: ClientToolContext;
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

export function activityLogConfigOf(
  request: McpRequest,
  { forestServerClient, logger }: Pick<ToolContext, 'forestServerClient' | 'logger'>,
): ActivityLogConfig {
  const { forestServerToken, renderingId } = getAuthContext(request);

  return {
    forestServer: {
      serverUrl: forestServerClient.forestServerUrl,
      serverToken: forestServerToken,
      renderingId,
    },
    activityLog: { source: ActivityLogSource.MCP, logger },
  };
}

function createClient(options: BuildClientOptions) {
  const { request, ctx, actionEndpoints = {} } = options;
  const { agentDispatcher } = ctx;
  const token = request.authInfo?.token;
  const url = request.authInfo?.extra?.environmentApiEndpoint;

  if (!token) {
    throw new Error('Authentication token is missing');
  }

  const activityLogConfig = activityLogConfigOf(request, ctx);

  const httpRequester = agentDispatcher
    ? new InProcessHttpRequester(token, agentDispatcher)
    : undefined;

  if (!httpRequester && (!url || typeof url !== 'string')) {
    throw new Error('Environment API endpoint is missing or invalid');
  }

  const rpcClient = createRemoteAgentClient({
    token,
    url: (url as string) ?? '',
    actionEndpoints,
    httpRequester,
    ...activityLogConfig,
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

  return createClient({ request, ctx, actionEndpoints });
}
