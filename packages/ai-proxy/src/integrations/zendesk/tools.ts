import type RemoteTool from '../../remote-tool';

import createCreateTicketTool from './tools/create-ticket';
import createCreateTicketCommentTool from './tools/create-ticket-comment';
import createGetTicketTool from './tools/get-ticket';
import createGetTicketCommentsTool from './tools/get-ticket-comments';
import createGetTicketsTool from './tools/get-tickets';
import createUpdateTicketTool from './tools/update-ticket';
import { getZendeskConfig } from './utils';
import ServerRemoteTool from '../../server-remote-tool';

export interface ZendeskConfig {
  subdomain: string;
  email: string;
  apiToken: string;
}

export default function getZendeskTools(config: ZendeskConfig): RemoteTool[] {
  const { baseUrl, headers } = getZendeskConfig(config);

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
