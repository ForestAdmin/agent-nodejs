import { allowedMethods } from '@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express from 'express';
import * as http from 'http';

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
