// eslint-disable-next-line import/no-extraneous-dependencies
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import runMcpServer from './simple-mcp-server';

const server = new McpServer({
  name: 'calculator',
  version: '1.0.0',
});

server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => {
  // eslint-disable-next-line no-console
  console.log('Received add request:', a, b);

  return { content: [{ type: 'text', text: String(a + b) }] };
});

runMcpServer(server, 3123);
