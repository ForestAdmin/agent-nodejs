#!/usr/bin/env node

import { allowedMethods } from '@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'; // eslint-disable-line import/extensions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; // eslint-disable-line import/extensions
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express from 'express';
import * as http from 'http';

import ForestAdminOAuthProvider from './auth/forest-oauth-provider.js';
import OAuthClient from './auth/oauth-client.js';
import ToolsCreator from './tools/tools.js';

/**
 * Forest Admin MCP Server
 *
 * This server provides HTTP REST API access to Forest Admin operations
 * with OAuth authentication support.
 *
 * Environment Variables:
 * - FOREST_ENV_SECRET: Your Forest Admin environment secret (required)
 * - AGENT_HOSTNAME: The URL of your Forest Admin agent (default: http://localhost:3310)
 * - FOREST_SERVER_URL: Forest Admin server URL (optional)
 * - MCP_SERVER_PORT: Port for the HTTP server (default: 3931)
 */

interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

class ForestAdminMCPServer {
  private oauthClient: OAuthClient;
  private mcpServer: McpServer;
  private mcpTransport?: StreamableHTTPServerTransport;
  private httpServer?: http.Server;
  private tools: ToolInfo[];

  constructor() {
    this.oauthClient = new OAuthClient();

    // Create MCP Server
    this.mcpServer = new McpServer(
      {
        name: '@forestadmin/mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.tools = [
      {
        name: 'forest_info',
        description:
          'Get information about the Forest Admin MCP server connection status and authentication.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'forest_authenticate',
        description:
          'Authenticate with Forest Admin using OAuth. Opens a browser for login and returns user information.',
        inputSchema: {
          type: 'object',
          properties: {
            renderingId: {
              type: 'number',
              description: 'The Forest Admin rendering ID (default: 1)',
            },
            callbackPort: {
              type: 'number',
              description: 'Port for the local OAuth callback server (default: 3333)',
            },
          },
        },
      },
    ];

    // Register tools with MCP Server
    this.setupTools();
  }

  private setupTools(): void {
    const toolsCreator = new ToolsCreator({ mcpServer: this.mcpServer });
    // Only the 'list' tool from ToolsCreator is active
    // forest_info and forest_authenticate tools are deactivated
  }

  async run(): Promise<void> {
    try {
      // Initialize OAuth client
      await this.oauthClient.initialize();

      const port = Number(process.env.MCP_SERVER_PORT) || 3931;
      const baseUrl = new URL(`http://localhost:${port}`);

      // Initialize MCP transport and connect server
      this.mcpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await this.mcpServer.connect(this.mcpTransport);

      // Create Express app
      const app = express();

      app.use(
        cors({
          origin: '*',
        }),
      );

      // Initialize and mount MCP OAuth router FIRST (at application root)
      const oauthProvider = new ForestAdminOAuthProvider();
      await oauthProvider.initialize();

      app.use(
        mcpAuthRouter({
          provider: oauthProvider,
          issuerUrl: baseUrl,
          baseUrl,
          scopesSupported: ['openid', 'profile', 'email'],
        }),
      );

      // Body parsers must come after OAuth router to avoid interfering with its parsing
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      app.use(allowedMethods(['POST']));

      // Apply bearer token authentication middleware to the MCP endpoint
      // The middleware will set req.auth with authentication info from the bearer token
      app.post(
        '/mcp',
        requireBearerAuth({
          verifier: oauthProvider,
          // requiredScopes: ['openid', 'profile', 'email'],
        }),
        (req, res) => {
          void (async () => {
            try {
              // Use the shared transport instance that's already connected to the MCP server
              if (!this.mcpTransport) {
                throw new Error('MCP transport not initialized');
              }

              // Handle the incoming request through the connected transport
              await this.mcpTransport.handleRequest(req, res, req.body);
            } catch (error) {
              console.error('[MCP Error]', error);

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
          })();
        },
      );

      // Create HTTP server from Express app
      this.httpServer = http.createServer(app);

      this.httpServer.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`[INFO] Forest Admin MCP Server running on http://localhost:${port}`);
        // eslint-disable-next-line no-console
        console.log(`[INFO] Agent hostname: ${this.oauthClient.getAgentHostname()}`);
        // eslint-disable-next-line no-console
        console.log(`[INFO] MCP Tool Endpoints:`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Health: http://localhost:${port}/health`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Tools: http://localhost:${port}/tools`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Execute: http://localhost:${port}/tools/execute`);
        // eslint-disable-next-line no-console
        console.log(`[INFO] OAuth Endpoints (via MCP SDK):`);
        // eslint-disable-next-line no-console
        console.log(
          `[INFO]   - Discovery: http://localhost:${port}/.well-known/oauth-authorization-server`,
        );
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Authorize: http://localhost:${port}/authorize`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Token: http://localhost:${port}/token`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Register: http://localhost:${port}/register`);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ERROR] Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new ForestAdminMCPServer();
server.run().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
