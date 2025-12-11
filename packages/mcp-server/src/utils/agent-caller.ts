import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { createRemoteAgentClient } from '@forestadmin-experimental/agent-nodejs-testing';

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
      renderingId: string;
      environmentId: number;
      projectId: number;
    },
  };
}
