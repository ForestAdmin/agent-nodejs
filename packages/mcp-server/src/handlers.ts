/**
 * Framework-agnostic MCP handlers.
 *
 * This module provides handlers that can be used with any HTTP framework (Express, Koa, etc.)
 * by returning data/results instead of directly manipulating response objects.
 */
import './polyfills';

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { IncomingMessage, ServerResponse } from 'http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import ForestOAuthProvider from './forest-oauth-provider';
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

/**
 * OAuth metadata as defined by RFC 8414
 */
export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  token_endpoint_auth_methods_supported: string[];
  response_types_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
}

/**
 * OAuth protected resource metadata as defined by RFC 9728
 */
export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
}

/**
 * Parameters for the authorize handler
 */
export interface AuthorizeParams {
  clientId: string;
  redirectUri?: string;
  codeChallenge: string;
  state?: string;
  scope?: string;
}

/**
 * Result of the authorize handler
 */
export type AuthorizeResult =
  | { type: 'redirect'; url: string }
  | { type: 'error'; status: number; error: string; errorDescription: string };

/**
 * Parameters for the token handler
 */
export interface TokenParams {
  grantType: string;
  clientId: string;
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  refreshToken?: string;
}

/**
 * Result of the token handler
 */
export type TokenResult =
  | { type: 'success'; tokens: OAuthTokens }
  | { type: 'error'; status: number; error: string; errorDescription?: string };

/**
 * Result of MCP request handling
 */
export type McpResult =
  | { type: 'handled' }
  | { type: 'error'; status: number; error: object };

/**
 * Options for McpHandlers
 */
export interface McpHandlersOptions {
  forestServerUrl: string;
  envSecret: string;
  authSecret: string;
  logger?: Logger;
}

/**
 * Framework-agnostic MCP handlers.
 *
 * Use this class to integrate MCP into any HTTP framework by calling the handler methods
 * and using the returned results to build framework-specific responses.
 *
 * @example
 * ```typescript
 * // In Koa
 * const handlers = new McpHandlers(options);
 * await handlers.initialize();
 *
 * router.get('/.well-known/oauth-authorization-server', ctx => {
 *   ctx.body = handlers.getOAuthMetadata(baseUrl);
 * });
 *
 * router.post('/oauth/authorize', async ctx => {
 *   const result = await handlers.handleAuthorize(params);
 *   if (result.type === 'redirect') ctx.redirect(result.url);
 *   else { ctx.status = result.status; ctx.body = { error: result.error }; }
 * });
 * ```
 */
export default class McpHandlers {
  public mcpServer: McpServer;
  public mcpTransport?: StreamableHTTPServerTransport;

  private oauthProvider: ForestOAuthProvider;
  private forestServerUrl: string;
  private logger: Logger;
  private initialized = false;

  constructor(options: McpHandlersOptions) {
    this.forestServerUrl = options.forestServerUrl;
    this.logger = options.logger || defaultLogger;

    this.oauthProvider = new ForestOAuthProvider({
      forestServerUrl: options.forestServerUrl,
      envSecret: options.envSecret,
      authSecret: options.authSecret,
      logger: this.logger,
    });

    this.mcpServer = new McpServer({ name: NAME, version: VERSION });
  }

  /**
   * Initialize the handlers. Must be called before using any handler methods.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize OAuth provider
    await this.oauthProvider.initialize();

    // Setup MCP transport
    this.mcpTransport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await this.mcpServer.connect(this.mcpTransport);

    // Setup tools
    await this.setupTools();

    this.initialized = true;
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

  /**
   * Get the base URL from the environment's api_endpoint.
   */
  getBaseUrl(): URL | undefined {
    return this.oauthProvider.getBaseUrl();
  }

  /**
   * Get OAuth Authorization Server metadata (RFC 8414)
   */
  getOAuthMetadata(baseUrl: URL): OAuthMetadata {
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

  /**
   * Get OAuth Protected Resource metadata (RFC 9728)
   */
  getProtectedResourceMetadata(baseUrl: URL): OAuthProtectedResourceMetadata {
    return {
      resource: new URL('mcp', baseUrl).href,
      authorization_servers: [baseUrl.href],
      scopes_supported: ['mcp:read', 'mcp:write', 'mcp:action', 'mcp:admin'],
    };
  }

  /**
   * Handle OAuth authorization request.
   * Returns a redirect URL or an error.
   */
  async handleAuthorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    // Validate client
    const client = await this.oauthProvider.clientsStore.getClient(params.clientId);

    if (!client) {
      return {
        type: 'error',
        status: 400,
        error: 'invalid_client',
        errorDescription: 'Invalid client_id',
      };
    }

    // Determine redirect URI
    let resolvedRedirectUri = params.redirectUri;

    if (!resolvedRedirectUri && client.redirect_uris.length === 1) {
      [resolvedRedirectUri] = client.redirect_uris;
    }

    if (!resolvedRedirectUri || !client.redirect_uris.includes(resolvedRedirectUri)) {
      return {
        type: 'error',
        status: 400,
        error: 'invalid_request',
        errorDescription: 'Invalid redirect_uri',
      };
    }

    // Get authorization URL from provider
    const redirectUrl = await this.oauthProvider.getAuthorizationUrl(
      client as OAuthClientInformationFull,
      {
        state: params.state || '',
        scopes: params.scope ? params.scope.split(' ') : [],
        redirectUri: resolvedRedirectUri,
        codeChallenge: params.codeChallenge,
      },
    );

    if (redirectUrl.startsWith('error:')) {
      // Provider returned an error redirect
      return { type: 'redirect', url: redirectUrl.slice(6) };
    }

    return { type: 'redirect', url: redirectUrl };
  }

  /**
   * Handle OAuth token request.
   * Returns tokens or an error.
   */
  async handleToken(params: TokenParams): Promise<TokenResult> {
    // Validate client
    const client = await this.oauthProvider.clientsStore.getClient(params.clientId);

    if (!client) {
      return {
        type: 'error',
        status: 400,
        error: 'invalid_client',
        errorDescription: 'Invalid client_id',
      };
    }

    try {
      let tokens: OAuthTokens;

      if (params.grantType === 'authorization_code') {
        tokens = await this.oauthProvider.exchangeAuthorizationCode(
          client as OAuthClientInformationFull,
          params.code || '',
          params.codeVerifier,
          params.redirectUri,
        );
      } else if (params.grantType === 'refresh_token') {
        tokens = await this.oauthProvider.exchangeRefreshToken(
          client as OAuthClientInformationFull,
          params.refreshToken || '',
        );
      } else {
        return {
          type: 'error',
          status: 400,
          error: 'unsupported_grant_type',
          errorDescription: `Grant type '${params.grantType}' is not supported`,
        };
      }

      return { type: 'success', tokens };
    } catch (error: unknown) {
      const oauthError = error as { errorCode?: string; message?: string };

      return {
        type: 'error',
        status: 400,
        error: oauthError.errorCode || 'invalid_request',
        errorDescription: oauthError.message,
      };
    }
  }

  /**
   * Verify an access token.
   * Returns auth info or throws an error.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    return this.oauthProvider.verifyAccessToken(token);
  }

  /**
   * Handle MCP protocol request.
   * This method writes directly to the response for streaming support.
   *
   * @param req - Node.js IncomingMessage
   * @param res - Node.js ServerResponse
   * @param body - Parsed request body
   */
  async handleMcpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
  ): Promise<McpResult> {
    if (!this.mcpTransport) {
      return {
        type: 'error',
        status: 500,
        error: {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'MCP transport not initialized' },
          id: null,
        },
      };
    }

    try {
      await this.mcpTransport.handleRequest(req, res, body);

      return { type: 'handled' };
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      this.logger('Error', `MCP Error: ${error}`);

      return {
        type: 'error',
        status: errorObj.message?.includes('token') ? 401 : 500,
        error: {
          jsonrpc: '2.0',
          error: { code: -32603, message: errorObj.message || 'Internal error' },
          id: null,
        },
      };
    }
  }
}
