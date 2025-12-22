// Import polyfills FIRST - before any MCP SDK imports
// This ensures URL.canParse is available for MCP SDK's Zod validation
import './polyfills';

import type { Express } from 'express';

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
import express from 'express';
import * as http from 'http';

import ForestOAuthProvider from './forest-oauth-provider';
import { isMcpRoute } from './mcp-paths';
import declareCreateTool from './tools/create';
import declareDeleteTool from './tools/delete';
import declareDescribeCollectionTool from './tools/describe-collection';
import declareExecuteActionTool from './tools/execute-action';
import declareGetActionFormTool from './tools/get-action-form';
import declareListTool from './tools/list';
import declareListRelatedTool from './tools/list-related';
import declareUpdateTool from './tools/update';
import { fetchForestSchema, getActionEndpoints, getCollectionNames } from './utils/schema-fetcher';
import interceptResponseForErrorLogging from './utils/sse-error-logger';
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

/** Fields that are safe to log for each tool (non-sensitive data) */
const SAFE_ARGUMENTS_FOR_LOGGING: Record<string, string[]> = {
  list: ['collectionName'],
  listRelated: ['collectionName', 'relationName', 'parentRecordId'],
  create: ['collectionName'],
  update: ['collectionName', 'recordId'],
  delete: ['collectionName', 'recordIds'],
  describeCollection: ['collectionName'],
  getActionForm: ['collectionName', 'actionName'],
  executeAction: ['collectionName', 'actionName'],
};

/**
 * Options for configuring the Forest Admin MCP Server
 */
export interface ForestMCPServerOptions {
  /** Forest Admin server URL */
  forestServerUrl?: string;
  /** Forest Admin app URL (for OAuth redirects) */
  forestAppUrl?: string;
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
  public forestAppUrl: string;

  private envSecret?: string;
  private authSecret?: string;
  private logger: Logger;

  constructor(options?: ForestMCPServerOptions) {
    this.forestServerUrl = options?.forestServerUrl || 'https://api.forestadmin.com';

    this.forestAppUrl = options?.forestAppUrl || 'https://app.forestadmin.com';

    this.envSecret = options?.envSecret;
    this.authSecret = options?.authSecret;
    this.logger = options?.logger || defaultLogger;

    this.mcpServer = new McpServer({
      name: NAME,
      version: VERSION,
    });
  }

  private async setupTools(): Promise<void> {
    let collectionNames: string[] = [];
    let actionEndpoints: Record<string, Record<string, { name: string; endpoint: string }>> = {};

    try {
      const schema = await fetchForestSchema(this.forestServerUrl);
      collectionNames = getCollectionNames(schema);
      actionEndpoints = getActionEndpoints(schema);
    } catch (error) {
      this.logger(
        'Warn',
        `Failed to fetch forest schema, collection names will not be available: ${error}`,
      );
    }

    declareDescribeCollectionTool(
      this.mcpServer,
      this.forestServerUrl,
      this.logger,
      collectionNames,
    );
    declareListTool(this.mcpServer, this.forestServerUrl, this.logger, collectionNames);
    declareListRelatedTool(this.mcpServer, this.forestServerUrl, this.logger, collectionNames);
    declareCreateTool(this.mcpServer, this.forestServerUrl, this.logger, collectionNames);
    declareUpdateTool(this.mcpServer, this.forestServerUrl, this.logger, collectionNames);
    declareDeleteTool(this.mcpServer, this.forestServerUrl, this.logger, collectionNames);
    declareGetActionFormTool(this.mcpServer, this.logger, collectionNames, actionEndpoints);
    declareExecuteActionTool(
      this.mcpServer,
      this.forestServerUrl,
      this.logger,
      collectionNames,
      actionEndpoints,
    );
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
   * Filters tool arguments to only include non-sensitive fields for logging.
   * Prevents accidentally logging sensitive data like search queries or filters.
   */
  private filterArgsForLogging(
    toolName: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const allowedFields = SAFE_ARGUMENTS_FOR_LOGGING[toolName] || [];

    return Object.fromEntries(Object.entries(args).filter(([key]) => allowedFields.includes(key)));
  }

  /**
   * Logs tool call information if the request is a tools/call method.
   */
  private logToolCallIfPresent(req: express.Request): void {
    interface McpToolCallBody {
      method?: string;
      params?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    }

    const body = req.body as McpToolCallBody;

    if (body?.method !== 'tools/call' || !body.params?.name) {
      return;
    }

    const toolName = body.params.name;
    const args = body.params.arguments || {};
    const safeArgs = this.filterArgsForLogging(toolName, args);

    this.logger('Info', `[MCP] Tool call: ${toolName} - params: ${JSON.stringify(safeArgs)}`);
  }

  /**
   * Handles an incoming MCP request.
   * Logs the request, intercepts the response for error logging, and delegates to the transport.
   */
  private async handleMcpRequest(req: express.Request, res: express.Response): Promise<void> {
    this.logger('Info', `[MCP] Incoming ${req.method} ${req.path}`);

    if (!this.mcpTransport) {
      throw new Error('MCP transport not initialized');
    }

    this.logToolCallIfPresent(req);
    interceptResponseForErrorLogging(res, this.logger);

    await this.mcpTransport.handleRequest(req, res, req.body);
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

    // Trust proxy headers when behind a reverse proxy (e.g., load balancer, nginx)
    // This is required for express-rate-limit to correctly identify clients
    app.set('trust proxy', 1);

    app.use(
      cors({
        origin: '*',
      }),
    );

    // Initialize OAuth provider
    const oauthProvider = new ForestOAuthProvider({
      forestServerUrl: this.forestServerUrl,
      forestAppUrl: this.forestAppUrl,
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

    // Request logging middleware - logs every request with response status
    app.use((req, res, next) => {
      const startTime = Date.now();

      // Capture the original end method to log after response is sent
      const originalEnd = res.end.bind(res);
      res.end = ((chunk?: unknown, encoding?: BufferEncoding | (() => void)) => {
        const duration = Date.now() - startTime;
        this.logger(
          'Info',
          `[${res.statusCode}] ${req.method} ${req.baseUrl || req.path} - ${duration}ms`,
        );

        return originalEnd(chunk, encoding as BufferEncoding);
      }) as typeof res.end;

      next();
    });

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
        this.handleMcpRequest(req, res).catch(error => {
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
        });
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
