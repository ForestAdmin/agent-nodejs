import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { allowedMethods } from '@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js';
import {
  createOAuthMetadata,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express from 'express';
import * as http from 'http';

import ForestAdminOAuthProvider from './forest-oauth-provider.js';

/**
 * Forest Admin MCP Server
 *
 * This server provides HTTP REST API access to Forest Admin operations
 * with OAuth authentication support.
 *
 * Environment Variables:
 * - FOREST_ENV_SECRET: Your Forest Admin environment secret (required)
 * - FOREST_AUTH_SECRET: Your Forest Admin authentication secret, it must be the same one as the one on your agent (required)
 * - FOREST_SERVER_URL: Forest Admin server URL (optional)
 * - MCP_SERVER_PORT: Port for the HTTP server (default: 3931)
 */

export default class ForestAdminMCPServer {
  public mcpServer: McpServer;
  public mcpTransport?: StreamableHTTPServerTransport;
  public httpServer?: http.Server;
  public forestServerUrl: string;

  constructor() {
    this.forestServerUrl =
      process.env.FOREST_SERVER_URL || process.env.FOREST_URL || 'https://api.forestadmin.com';

    // Create MCP Server
    this.mcpServer = new McpServer({
      name: '@forestadmin/mcp-server',
      version: '0.1.0',
    });

    // Register tools with MCP Server
    this.setupTools();
  }

  private setupTools(): void {
    // FIXME: To implement
  }

  private ensureEnvironmentVariablesAreSet(): void {
    if (!process.env.FOREST_ENV_SECRET) {
      throw new Error('FOREST_ENV_SECRET environment variable is not set');
    }

    if (!process.env.FOREST_AUTH_SECRET) {
      throw new Error('FOREST_AUTH_SECRET environment variable is not set');
    }
  }

  async run(): Promise<void> {
    this.ensureEnvironmentVariablesAreSet();

    const port = Number(process.env.MCP_SERVER_PORT) || 3931;
    const baseUrl = new URL(`http://localhost:${port}`);

    this.mcpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await this.mcpServer.connect(this.mcpTransport);

    const app = express();

    app.use(
      cors({
        origin: '*',
      }),
    );

    // Initialize OAuth provider
    const oauthProvider = new ForestAdminOAuthProvider({ forestServerUrl: this.forestServerUrl });
    await oauthProvider.initialize();

    const scopesSupported = [
      'mcp:read',
      'mcp:write',
      'mcp:action',
      'mcp:admin',
      'profile',
      'email',
    ];

    // Create OAuth metadata with custom registration_endpoint pointing to Forest Admin
    const oauthMetadata = createOAuthMetadata({
      provider: oauthProvider,
      issuerUrl: baseUrl,
      baseUrl,
      scopesSupported,
    });

    oauthMetadata.grant_types_supported = ['authorization_code'];
    oauthMetadata.token_endpoint_auth_methods_supported = ['none'];
    oauthMetadata.response_types_supported = ['code'];
    oauthMetadata.code_challenge_methods_supported = ['S256'];

    // Override registration_endpoint to point to Forest Admin server
    oauthMetadata.registration_endpoint = `${this.forestServerUrl}/oauth/register`;
    // Remove revocation_endpoint from metadata (not supported)
    delete oauthMetadata.revocation_endpoint;

    // Mount authorization and token handlers
    app.use('/authorize', authorizationHandler({ provider: oauthProvider }));
    app.use('/token', tokenHandler({ provider: oauthProvider }));

    // Mount metadata router with custom metadata
    app.use(
      mcpAuthMetadataRouter({
        oauthMetadata,
        resourceServerUrl: baseUrl,
        scopesSupported,
      }),
    );

    // Body parsers must come after OAuth router to avoid interfering with its parsing
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(allowedMethods(['POST']));

    app.post('/mcp', (req, res) => {
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
                message: (error as Error)?.message || 'Internal server error',
              },
              id: null,
            });
          }
        }
      })();
    });

    // Create HTTP server from Express app
    this.httpServer = http.createServer(app);

    this.httpServer.listen(port, () => {
      console.info(`[INFO] Forest Admin MCP Server running on http://localhost:${port}`);
    });
  }
}
