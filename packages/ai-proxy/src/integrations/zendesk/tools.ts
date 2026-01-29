import type RemoteTool from '../../types/remote-tool';

import createCreateTicketTool from './tools/create-ticket';
import createCreateTicketCommentTool from './tools/create-ticket-comment';
import createGetTicketTool from './tools/get-ticket';
import createGetTicketCommentsTool from './tools/get-ticket-comments';
import createGetTicketsTool from './tools/get-tickets';
import createUpdateTicketTool from './tools/update-ticket';
import ServerRemoteTool from '../../types/server-remote-tool';

export interface ZendeskConfig {
  subdomain: string;
  email: string;
  apiToken: string;
}

export default function getZendeskTools(config: ZendeskConfig): RemoteTool[] {
  const baseUrl = `https://${config.subdomain}.zendesk.com/api/v2`;
  const auth = Buffer.from(`${config.email}/token:${config.apiToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  return [
    createGetTicketsTool(headers, baseUrl),
    createGetTicketTool(headers, baseUrl),
    createGetTicketCommentsTool(headers, baseUrl),
    createCreateTicketTool(headers, baseUrl),
    createCreateTicketCommentTool(headers, baseUrl),
    createUpdateTicketTool(headers, baseUrl),
  ].map(
    tool =>
      new ServerRemoteTool({
        sourceId: 'zendesk',
        tool,
      }),
  );
}
