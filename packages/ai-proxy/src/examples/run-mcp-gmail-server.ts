/* eslint-disable import/no-extraneous-dependencies, import/extensions */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/* eslint-enable import/no-extraneous-dependencies, import/extensions */

import runMcpServer from './simple-mcp-server';

const server = new McpServer({
  name: 'gmail',
  version: '1.0.0',
});

// Gmail API configuration
// To use this, you'll need to:
// 1. Enable Gmail API in Google Cloud Console
// 2. Create OAuth 2.0 credentials
// 3. Get an access token
const GMAIL_ACCESS_TOKEN = 'YOUR_GMAIL_ACCESS_TOKEN';

const headers = {
  Authorization: `Bearer ${GMAIL_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

server.tool('gmail_search', { query: 'string', maxResults: 'number' }, async params => {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', params.query);
  url.searchParams.set('maxResults', (params.maxResults || 10).toString());

  const response = await fetch(url.toString(), { headers });
  const data = await response.json();

  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
});

server.tool(
  'gmail_send_message',
  { to: 'array', subject: 'string', message: 'string' },
  async params => {
    const emailLines = [
      `To: ${params.to.join(', ')}`,
      `Subject: ${params.subject}`,
      '',
      params.message,
    ];

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers,
      body: JSON.stringify({ raw: encodedEmail }),
    });

    const data = await response.json();

    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  },
);

server.tool('gmail_get_message', { messageId: 'string' }, async params => {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${params.messageId}?format=full`,
    { headers },
  );

  const data = await response.json();

  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
});

runMcpServer(server, 3125);
