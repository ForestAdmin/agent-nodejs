import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { createRemoteAgentClient } from '@forestadmin-experimental/agent-nodejs-testing';

export default function buildClient(
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
) {
  const token = request.authInfo?.token;

  const rpcClient = createRemoteAgentClient({
    token,
    url: request.authInfo?.extra?.environmentApiEndpoint as string,
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
