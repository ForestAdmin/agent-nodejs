/**
 * MCP Server using Koa instead of Express.
 *
 * This implementation uses the same ForestOAuthProvider but with Koa handlers
 * instead of the Express handlers from the MCP SDK.
 */
import './polyfills';

import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Context, Middleware, Next } from 'koa';

import bodyParser from '@koa/bodyparser';
import cors from '@koa/cors';
import Router from '@koa/router';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as http from 'http';
import Koa from 'koa';

import ForestOAuthProvider from './forest-oauth-provider';
import { isMcpRoute } from './mcp-paths';
import declareListTool from './tools/list';
import { fetchForestSchema, getCollectionNames } from './utils/schema-fetcher';
import { NAME, VERSION } from './version';

export type LogLevel = 'Debug' | 'Info' | 'Warn' | 'Error';
export type Logger = (level: LogLevel, message: string) => void;

const defaultLogger: Logger = (level, message) => {
  if (level === 'Error') console.error(`[MCP Server] ${message}`);
  else if (level === 'Warn') console.warn(`[MCP Server] ${message}`);
  else console.info(`[MCP Server] ${message}`);
};

export interface KoaMcpServerOptions {
  forestServerUrl?: string;
  envSecret?: string;
  authSecret?: string;
  logger?: Logger;
}

/**
 * Forest Admin MCP Server using Koa
 */
export default class KoaMcpServer {
  public mcpServer: McpServer;
  public mcpTransport?: StreamableHTTPServerTransport;
  public koaApp?: Koa;
  public httpServer?: http.Server;
  public forestServerUrl: string;

  private envSecret?: string;
  private authSecret?: string;
  private logger: Logger;
  private oauthProvider?: ForestOAuthProvider;

  constructor(options?: KoaMcpServerOptions) {
    this.forestServerUrl =
      options?.forestServerUrl || process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com';
    this.envSecret = options?.envSecret || process.env.FOREST_ENV_SECRET;
    this.authSecret = options?.authSecret || process.env.FOREST_AUTH_SECRET;
    this.logger = options?.logger || defaultLogger;

    this.mcpServer = new McpServer({ name: NAME, version: VERSION });
  }

  private async setupTools(): Promise<void> {
    try {
      const schema = await fetchForestSchema(this.forestServerUrl);
      const collectionNames = getCollectionNames(schema);
      declareListTool(this.mcpServer, this.forestServerUrl, collectionNames);
    } catch (error) {
      this.logger('Warn', `Failed to fetch forest schema: ${error}`);
    }
  }

  private ensureSecrets(): { envSecret: string; authSecret: string } {
    if (!this.envSecret) throw new Error('FOREST_ENV_SECRET is required');
    if (!this.authSecret) throw new Error('FOREST_AUTH_SECRET is required');

    return { envSecret: this.envSecret, authSecret: this.authSecret };
  }

  /**
   * Build the Koa app with all routes
   */
  async buildKoaApp(baseUrl?: URL): Promise<Koa> {
    const { envSecret, authSecret } = this.ensureSecrets();

    await this.setupTools();

    this.mcpTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await this.mcpServer.connect(this.mcpTransport);

    // Initialize OAuth provider
    this.oauthProvider = new ForestOAuthProvider({
      forestServerUrl: this.forestServerUrl,
      envSecret,
      authSecret,
      logger: this.logger,
    });
    await this.oauthProvider.initialize();

    const effectiveBaseUrl = baseUrl || this.oauthProvider.getBaseUrl();

    if (!effectiveBaseUrl) {
      throw new Error('Could not determine base URL for MCP server');
    }

    // Create Koa app
    const app = new Koa();
    app.use(cors({ credentials: true }));

    // Create router with OAuth and MCP routes
    const router = new Router();

    // OAuth metadata endpoint
    router.get('/.well-known/oauth-authorization-server', ctx => {
      ctx.body = this.buildOAuthMetadata(effectiveBaseUrl);
    });

    // OAuth protected resource metadata (for MCP)
    router.get('/.well-known/oauth-protected-resource', ctx => {
      ctx.body = {
        resource: new URL('mcp', effectiveBaseUrl).href,
        authorization_servers: [effectiveBaseUrl.href],
        scopes_supported: ['mcp:read', 'mcp:write', 'mcp:action', 'mcp:admin'],
      };
    });

    // Authorization endpoint
    router.get('/oauth/authorize', bodyParser(), async ctx => {
      await this.handleAuthorize(ctx);
    });
    router.post('/oauth/authorize', bodyParser(), async ctx => {
      await this.handleAuthorize(ctx);
    });

    // Token endpoint
    router.post('/oauth/token', bodyParser(), async ctx => {
      await this.handleToken(ctx);
    });

    // MCP endpoint (protected)
    router.post('/mcp', bodyParser(), async ctx => {
      await this.handleMcp(ctx);
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    this.koaApp = app;

    return app;
  }

  private buildOAuthMetadata(baseUrl: URL) {
    return {
      issuer: baseUrl.href,
      authorization_endpoint: `${baseUrl.href}oauth/authorize`,
      token_endpoint: `${baseUrl.href}oauth/token`,
      registration_endpoint: `${this.forestServerUrl}/oauth/register`,
      token_endpoint_auth_methods_supported: ['none'],
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['mcp:read', 'mcp:write', 'mcp:action', 'mcp:admin'],
    };
  }

  private async handleAuthorize(ctx: Context): Promise<void> {
    ctx.set('Cache-Control', 'no-store');

    const params = ctx.method === 'POST' ? ctx.request.body : ctx.query;
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      state,
      scope,
    } = params as Record<string, string>;

    // Validate client
    const client = await this.oauthProvider?.clientsStore.getClient(clientId);

    if (!client) {
      ctx.status = 400;
      ctx.body = { error: 'invalid_client', error_description: 'Invalid client_id' };

      return;
    }

    // Determine redirect URI
    let resolvedRedirectUri = redirectUri;

    if (!resolvedRedirectUri && client.redirect_uris.length === 1) {
      [resolvedRedirectUri] = client.redirect_uris;
    }

    if (!resolvedRedirectUri || !client.redirect_uris.includes(resolvedRedirectUri)) {
      ctx.status = 400;
      ctx.body = { error: 'invalid_request', error_description: 'Invalid redirect_uri' };

      return;
    }

    // Create a mock response object for the provider (it expects Express Response)
    const mockRes = {
      redirect: (url: string) => {
        ctx.redirect(url);
      },
    };

    await this.oauthProvider?.authorize(
      client as OAuthClientInformationFull,
      {
        state: state || '',
        scopes: scope ? scope.split(' ') : [],
        redirectUri: resolvedRedirectUri,
        codeChallenge,
      },
      mockRes as Parameters<ForestOAuthProvider['authorize']>[2],
    );
  }

  private async handleToken(ctx: Context): Promise<void> {
    const body = ctx.request.body as Record<string, string>;
    const {
      grant_type: grantType,
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      refresh_token: refreshToken,
    } = body;

    const client = await this.oauthProvider?.clientsStore.getClient(clientId);

    if (!client) {
      ctx.status = 400;
      ctx.body = { error: 'invalid_client', error_description: 'Invalid client_id' };

      return;
    }

    try {
      let tokens;

      if (grantType === 'authorization_code') {
        tokens = await this.oauthProvider?.exchangeAuthorizationCode(
          client as OAuthClientInformationFull,
          code,
          codeVerifier,
          redirectUri,
        );
      } else if (grantType === 'refresh_token') {
        tokens = await this.oauthProvider?.exchangeRefreshToken(
          client as OAuthClientInformationFull,
          refreshToken,
        );
      } else {
        ctx.status = 400;
        ctx.body = { error: 'unsupported_grant_type' };

        return;
      }

      ctx.body = tokens;
    } catch (error: unknown) {
      ctx.status = 400;
      const oauthError = error as { errorCode?: string; message?: string };
      ctx.body = {
        error: oauthError.errorCode || 'invalid_request',
        error_description: oauthError.message,
      };
    }
  }

  private async handleMcp(ctx: Context): Promise<void> {
    // Extract bearer token
    const authHeader = ctx.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      ctx.status = 401;
      ctx.body = { error: 'unauthorized', error_description: 'Bearer token required' };

      return;
    }

    const token = authHeader.slice(7);

    try {
      // Verify token
      const authInfo = await this.oauthProvider?.verifyAccessToken(token);

      // Check scopes
      if (!authInfo?.scopes.includes('mcp:read')) {
        ctx.status = 403;
        ctx.body = { error: 'insufficient_scope', error_description: 'mcp:read scope required' };

        return;
      }

      // Handle MCP request
      if (!this.mcpTransport) {
        throw new Error('MCP transport not initialized');
      }

      // Use the transport to handle the request
      // Note: We need to pass raw req/res for streaming support
      await this.mcpTransport.handleRequest(ctx.req, ctx.res, ctx.request.body);
      ctx.respond = false; // Let the transport handle the response
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      this.logger('Error', `MCP Error: ${error}`);
      ctx.status = errorObj.message?.includes('token') ? 401 : 500;
      ctx.body = {
        jsonrpc: '2.0',
        error: { code: -32603, message: errorObj.message || 'Internal error' },
        id: null,
      };
    }
  }

  /**
   * Get a Koa middleware that handles MCP routes.
   * Can be mounted on an existing Koa app.
   */
  async getKoaMiddleware(baseUrl?: URL): Promise<Middleware> {
    const app = await this.buildKoaApp(baseUrl);

    return async (ctx: Context, next: Next) => {
      if (isMcpRoute(ctx.url)) {
        await app.callback()(ctx.req, ctx.res);
        ctx.respond = false;
      } else {
        await next();
      }
    };
  }

  /**
   * Run as standalone server
   */
  async run(): Promise<void> {
    const port = Number(process.env.MCP_SERVER_PORT) || 3931;
    const baseUrl = new URL(`http://localhost:${port}`);

    const app = await this.buildKoaApp(baseUrl);
    this.httpServer = http.createServer(app.callback());

    this.httpServer.listen(port, () => {
      this.logger('Info', `Forest Admin MCP Server (Koa) running on http://localhost:${port}`);
    });
  }
}
