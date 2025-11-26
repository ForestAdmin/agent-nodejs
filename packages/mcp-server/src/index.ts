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
import { handleForestAuthenticate, handleForestInfo } from './tools/placeholder.js';

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
    // Register forest_info tool
    this.mcpServer.registerTool(
      'forest_info',
      {
        description:
          'Get information about the Forest Admin MCP server connection status and authentication.',
        inputSchema: {
          type: 'object',
          properties: {},
        } as any,
      },
      async () => {
        try {
          if (!this.oauthClient.isInitialized()) {
            await this.oauthClient.initialize();
          }

          const result = await handleForestInfo(this.oauthClient);

          return {
            content: [
              {
                type: 'text' as const,
                text: result,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // Register forest_authenticate tool
    this.mcpServer.registerTool(
      'forest_authenticate',
      {
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
        } as any,
      },
      async (args: Record<string, unknown>) => {
        try {
          if (!this.oauthClient.isInitialized()) {
            await this.oauthClient.initialize();
          }

          const result = await handleForestAuthenticate(
            this.oauthClient,
            args as { renderingId?: number; callbackPort?: number },
          );

          return {
            content: [
              {
                type: 'text' as const,
                text: result,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      // Ensure OAuth client is initialized
      if (!this.oauthClient.isInitialized()) {
        await this.oauthClient.initialize();
      }

      // Route to appropriate tool handler
      switch (toolName) {
        case 'forest_info': {
          const result = await handleForestInfo(this.oauthClient);

          return { success: true, result };
        }

        case 'forest_authenticate': {
          const result = await handleForestAuthenticate(
            this.oauthClient,
            args as { renderingId?: number; callbackPort?: number },
          );

          return { success: true, result };
        }

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return { success: false, error: errorMessage };
    }
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
      // CORS middleware - must be first
      // app.use((req, res, next) => {
      //   res.setHeader('Access-Control-Allow-Origin', '*');
      //   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      //   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      //   if (req.method === 'OPTIONS') {
      //     res.status(200).end();

      //     return;
      //   }

      //   next();
      // });

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
        // requireBearerAuth({
        //   verifier: oauthProvider,
        //   requiredScopes: ['openid', 'profile', 'email'],
        // }),
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

      // // Health check endpoint
      // app.get('/health', (_req, res) => {
      //   res.json({
      //     status: 'healthy',
      //     authenticated: this.oauthClient.isAuthenticated(),
      //     agentHostname: this.oauthClient.getAgentHostname(),
      //   });
      // });

      // // List available tools
      // app.get('/tools', (_req, res) => {
      //   res.json({ tools: this.tools });
      // });

      // // Execute a tool
      // app.post('/tools/execute', async (req, res) => {
      //   try {
      //     const { tool, args } = req.body as { tool: string; args?: Record<string, unknown> };
      //     const result = await this.handleToolCall(tool, args || {});

      //     res.json(result);
      //   } catch (error) {
      //     res.status(400).json({ success: false, error: 'Invalid request' });
      //   }
      // });

      // // Default 404 handler
      // app.use((_req, res) => {
      //   res.status(404).json({
      //     error: 'Not found',
      //     endpoints: {
      //       'GET /health': 'Health check endpoint',
      //       'GET /tools': 'List available tools',
      //       'POST /tools/execute': 'Execute a tool (body: { tool: string, args?: object })',
      //       'GET /.well-known/oauth-authorization-server': 'OAuth discovery endpoint (RFC 8414)',
      //       'GET /authorize': 'OAuth authorization endpoint',
      //       'POST /token': 'OAuth token endpoint',
      //       'POST /register': 'OAuth client registration endpoint',
      //     },
      //   });
      // });

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
