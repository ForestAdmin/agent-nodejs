import type RemoteTool from '../../remote-tool';

import createCreateTicketTool from './tools/create-ticket';
import createCreateTicketCommentTool from './tools/create-ticket-comment';
import createGetTicketTool from './tools/get-ticket';
import createGetTicketCommentsTool from './tools/get-ticket-comments';
import createGetTicketsTool from './tools/get-tickets';
import createUpdateTicketTool from './tools/update-ticket';
import { getZendeskConfig } from './utils';
import ServerRemoteTool from '../../server-remote-tool';

export type ZendeskConfig = { subdomain: string } & (
  | { email: string; apiToken: string }
  | { clientId: string; clientSecret: string }
);

export default function getZendeskTools(config: ZendeskConfig, mcpServerId?: string): RemoteTool[] {
  const { baseUrl, request } = getZendeskConfig(config);

  return [
    createGetTicketsTool(request, baseUrl),
    createGetTicketTool(request, baseUrl),
    createGetTicketCommentsTool(request, baseUrl),
    createCreateTicketTool(request, baseUrl),
    createCreateTicketCommentTool(request, baseUrl),
    createUpdateTicketTool(request, baseUrl),
  ].map(
    tool =>
      new ServerRemoteTool({
        sourceId: 'zendesk',
        mcpServerId,
        tool,
      }),
  );
}
