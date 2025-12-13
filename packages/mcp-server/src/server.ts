// Import polyfills FIRST - before any MCP SDK imports
// This ensures URL.canParse is available for MCP SDK's Zod validation
import './polyfills';

import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { allowedMethods } from '@modelcontextprotocol/sdk/server/auth/middleware/allowedMethods.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  createOAuthMetadata,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express, { Express } from 'express';
import * as http from 'http';

import ForestOAuthProvider from './forest-oauth-provider';
import { isMcpRoute } from './mcp-paths';
import declareListTool from './tools/list';
import { fetchForestSchema, getCollectionNames } from './utils/schema-fetcher';
import { NAME, VERSION } from './version';

export type LogLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LogLevel, message: string) => void;

export type HttpCallback = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  next?: () => void,
) => void;

function getDefaultLogFn(level: LogLevel): (message: string) => void {
  if (level === 'Error') return (msg: string) => console.error(`[MCP Server] ${msg}`);
  if (level === 'Warn') return (msg: string) => console.warn(`[MCP Server] ${msg}`);

  return (msg: string) => console.info(`[MCP Server] ${msg}`);
}

const defaultLogger: Logger = (level, message) => {
  getDefaultLogFn(level)(message);
};

/**
 * Options for configuring the Forest Admin MCP Server
 */
export interface ForestMCPServerOptions {
  /** Forest Admin server URL */
  forestServerUrl?: string;
  /** Forest Admin environment secret */
  envSecret?: string;
  /** Forest Admin authentication secret */
  authSecret?: string;
  /** Optional logger function. Defaults to console logging. */
  logger?: Logger;
}

/**
 * Forest Admin MCP Server
 *
 * This server provides HTTP REST API access to Forest Admin operations
 * with OAuth authentication support.
 *
 * Environment Variables (used as fallback when options not provided):
 * - FOREST_ENV_SECRET: Your Forest Admin environment secret (required)
 * - FOREST_AUTH_SECRET: Your Forest Admin authentication secret, it must be the same one as the one on your agent (required)
 * - FOREST_SERVER_URL: Forest Admin server URL (optional)
 * - MCP_SERVER_PORT: Port for the HTTP server (default: 3931)
 */

export default class ForestMCPServer {
  public mcpServer: McpServer;
  public mcpTransport?: StreamableHTTPServerTransport;
  public httpServer?: http.Server;
  public expressApp?: Express;
  public forestServerUrl: string;

  private envSecret?: string;
  private authSecret?: string;
  private logger: Logger;

  constructor(options?: ForestMCPServerOptions) {
    this.forestServerUrl =
      options?.forestServerUrl ||
      process.env.FOREST_SERVER_URL ||
      process.env.FOREST_URL ||
      'https://api.forestadmin.com';

    this.envSecret = options?.envSecret || process.env.FOREST_ENV_SECRET;
    this.authSecret = options?.authSecret || process.env.FOREST_AUTH_SECRET;
    this.logger = options?.logger || defaultLogger;

    this.mcpServer = new McpServer({
      name: NAME,
      version: VERSION,
    });
  }

  private async setupTools(): Promise<void> {
    let collectionNames: string[] = [];

    try {
      const schema = await fetchForestSchema(this.forestServerUrl);
      collectionNames = getCollectionNames(schema);
    } catch (error) {
      this.logger(
        'Warn',
        `Failed to fetch forest schema, collection names will not be available: ${error}`,
      );
    }

    declareListTool(this.mcpServer, this.forestServerUrl, collectionNames);
  }

  private ensureSecretsAreSet(): { envSecret: string; authSecret: string } {
    if (!this.envSecret) {
      throw new Error(
        'FOREST_ENV_SECRET is not set. Provide it via options.envSecret or FOREST_ENV_SECRET environment variable.',
      );
    }

    if (!this.authSecret) {
      throw new Error(
        'FOREST_AUTH_SECRET is not set. Provide it via options.authSecret or FOREST_AUTH_SECRET environment variable.',
      );
    }

    return { envSecret: this.envSecret, authSecret: this.authSecret };
  }

  /**
   * Build and return the Express app without starting a standalone server.
   * Useful for embedding the MCP server into another application.
   *
   * @param baseUrl - Optional base URL override. If not provided, will use the
   *                  environmentApiEndpoint from Forest Admin API.
   * @returns The configured Express application
   */
  async buildExpressApp(baseUrl?: URL): Promise<Express> {
    const { envSecret, authSecret } = this.ensureSecretsAreSet();

    // Fetch schema and setup tools before building the app
    await this.setupTools();

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
    const oauthProvider = new ForestOAuthProvider({
      forestServerUrl: this.forestServerUrl,
      envSecret,
      authSecret,
      logger: this.logger,
    });
    await oauthProvider.initialize();

    // Use provided baseUrl or get it from the OAuth provider (environmentApiEndpoint)
    const effectiveBaseUrl = baseUrl || oauthProvider.getBaseUrl();

    if (!effectiveBaseUrl) {
      throw new Error(
        'Could not determine base URL for MCP server. ' +
          'Either provide a baseUrl parameter or ensure the Forest Admin environment has an api_endpoint configured.',
      );
    }

    const scopesSupported = ['mcp:read', 'mcp:write', 'mcp:action', 'mcp:admin'];

    // Create OAuth metadata with custom registration_endpoint pointing to Forest Admin
    const oauthMetadata = createOAuthMetadata({
      provider: oauthProvider,
      issuerUrl: effectiveBaseUrl,
      baseUrl: effectiveBaseUrl,
      scopesSupported,
    });

    oauthMetadata.token_endpoint_auth_methods_supported = ['none'];
    oauthMetadata.response_types_supported = ['code'];
    oauthMetadata.code_challenge_methods_supported = ['S256'];

    oauthMetadata.token_endpoint = `${effectiveBaseUrl.href}oauth/token`;
    oauthMetadata.authorization_endpoint = `${effectiveBaseUrl.href}oauth/authorize`;
    // Override registration_endpoint to point to Forest Admin server
    oauthMetadata.registration_endpoint = `${this.forestServerUrl}/oauth/register`;
    // Remove revocation_endpoint from metadata (not supported)
    delete oauthMetadata.revocation_endpoint;

    // Body parsers MUST come before OAuth handlers because the token handler
    // expects req.body to be parsed. When proxied from Koa, the body is already
    // available but Express needs to see it properly.
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
      '/oauth/authorize',
      authorizationHandler({
        provider: oauthProvider,
      }),
    );
    app.use('/oauth/token', tokenHandler({ provider: oauthProvider }));

    // Mount metadata router with custom metadata
    // The resourceServerUrl should include the /mcp path to match RFC 9728 requirements.
    // This creates the .well-known/oauth-protected-resource/mcp endpoint.
    const mcpResourceUrl = new URL('mcp', effectiveBaseUrl);
    app.use(
      mcpAuthMetadataRouter({
        oauthMetadata,
        resourceServerUrl: mcpResourceUrl,
        scopesSupported,
      }),
    );

    app.use(allowedMethods(['POST']));

    app.post(
      '/mcp',
      requireBearerAuth({
        verifier: oauthProvider,
        requiredScopes: ['mcp:read'],
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
            this.logger('Error', `MCP Error: ${error}`);

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
      },
    );

    // Global error handler to catch any unhandled errors
    // Express requires all 4 parameters to recognize this as an error handler
    // Capture logger for use in error handler (arrow function would lose context)
    const { logger } = this;
    app.use(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        logger('Error', `Unhandled error: ${err.message}`);

        if (!res.headersSent) {
          res.status(500).json({
            error: 'internal_server_error',
            error_description: err.message,
          });
        }
      },
    );

    this.expressApp = app;

    return app;
  }

  /**
   * Build and return an HTTP callback that can be used as middleware.
   * The callback will handle MCP-related routes (/.well-known/*, /oauth/*, /mcp)
   * and call next() for other routes.
   *
   * @param baseUrl - Optional base URL override. If not provided, will use the
   *                  environmentApiEndpoint from Forest Admin API.
   * @returns An HTTP callback function
   */
  async getHttpCallback(baseUrl?: URL): Promise<HttpCallback> {
    const app = await this.buildExpressApp(baseUrl);

    return (req, res, next) => {
      const url = req.url || '/';

      if (isMcpRoute(url)) {
        // Fix for streams that have been consumed by another framework (like Koa)
        // Express's finalhandler calls unpipe() which expects _readableState.pipes to exist
        // Node.js unpipe() accesses _readableState.pipes.length, so pipes must be an array
        /* eslint-disable @typescript-eslint/no-explicit-any, no-underscore-dangle */
        const reqAny = req as any;

        // Ensure _readableState exists with proper structure
        if (!reqAny._readableState) {
          reqAny._readableState = {
            pipes: [],
            pipesCount: 0,
            flowing: null,
            ended: true,
            endEmitted: true,
            reading: false,
          };
        } else if (!Array.isArray(reqAny._readableState.pipes)) {
          // pipes must be an array for Node.js unpipe() to work
          reqAny._readableState.pipes = [];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, no-underscore-dangle */

        // Handle MCP route with Express app
        app(req, res);
      } else if (next) {
        // Not an MCP route, call next middleware
        next();
      } else {
        // No next callback and not an MCP route - this shouldn't happen in normal usage
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    };
  }

  /**
   * Run the MCP server as a standalone HTTP server.
   */
  async run(): Promise<void> {
    const port = Number(process.env.MCP_SERVER_PORT) || 3931;
    const baseUrl = new URL(`http://localhost:${port}`);

    const app = await this.buildExpressApp(baseUrl);

    // Create HTTP server from Express app
    this.httpServer = http.createServer(app);

    this.httpServer.listen(port, () => {
      this.logger('Info', `Forest Admin MCP Server running on http://localhost:${port}`);
    });
  }
}
