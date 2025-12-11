/* eslint-disable import/no-extraneous-dependencies, import/extensions */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
/* eslint-enable import/no-extraneous-dependencies, import/extensions */

const BEARER_TOKEN = 'your-secure-token-here';

export default (server: McpServer, port: number, secureToken: string = BEARER_TOKEN) => {
  const app = express();
  app.use(express.json());

  // Bearer Token Middleware
  app.use('/mcp', (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (token !== secureToken) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid or missing Bearer token',
        },
        id: null,
      });

      return;
    }

    next();
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/mcp', async (req, res) => {
    try {
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on('close', () => {
        // eslint-disable-next-line no-console
        console.log('Request closed');
        void transport.close();
        void server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/mcp', async (req, res) => {
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.delete('/mcp', async (req, res) => {
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
  });

  return app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`MCP Stateless Streamable HTTP Server listening on port ${port}`);
  });
};
