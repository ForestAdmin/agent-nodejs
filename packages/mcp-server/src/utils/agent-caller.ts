import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

export default function buildClient(
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
) {
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
    actionEndpoints: {},
  });

  return {
    rpcClient,
    authData: request.authInfo?.extra as {
      userId: number;
      renderingId: number;
      environmentId?: number;
      projectId?: number;
      environmentApiEndpoint: string;
    },
  };
}
