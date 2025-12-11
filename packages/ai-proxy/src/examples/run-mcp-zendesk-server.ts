/* eslint-disable import/no-extraneous-dependencies, import/extensions */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import zendesk from 'node-zendesk';
/* eslint-enable import/no-extraneous-dependencies, import/extensions */

import runMcpServer from './simple-mcp-server';

const client = zendesk.createClient({
  username: 'your-email@example.com',
  token: 'YOUR_ZENDESK_API_TOKEN',
  subdomain: 'your-subdomain',
});

const server = new McpServer({
  name: 'zendesk',
  version: '1.0.0',
});

server.tool('listUsers', {}, async () => {
  const users = await client.users.list();

  return { content: [{ type: 'text', text: JSON.stringify(users.map(u => u.name)) }] };
});

server.tool('listArticles', {}, async () => {
  const articles = await client.helpcenter.articles.list();

  return { content: [{ type: 'text', text: JSON.stringify(articles) }] };
});

runMcpServer(server, 3124);
