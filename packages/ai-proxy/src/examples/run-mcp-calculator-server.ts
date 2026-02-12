/* eslint-disable import/no-extraneous-dependencies, import/extensions */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
/* eslint-enable import/no-extraneous-dependencies, import/extensions */

import runMcpServer from './simple-mcp-server';

const server = new McpServer({
  name: 'calculator',
  version: '1.0.0',
});

server.registerTool(
  'add',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { inputSchema: { a: z.number(), b: z.number() } as any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ a, b }: any) => {
    // eslint-disable-next-line no-console
    console.log('Received add request:', a, b);

    return { content: [{ type: 'text' as const, text: String(a + b) }] };
  },
);

runMcpServer(server, 3123);
