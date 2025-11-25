#!/usr/bin/env node

import * as crypto from 'crypto';
import * as http from 'http';
import * as url from 'url';

import OAuthClient from './auth/oauth-client.js';
import {
  forestAuthenticateTool,
  forestInfoTool,
  handleForestAuthenticate,
  handleForestInfo,
} from './tools/placeholder.js';

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

interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  scope: string;
}

interface PendingAuthorization {
  code: string;
  request: AuthorizationRequest;
  expiresAt: number;
}

class ForestAdminMCPServer {
  private oauthClient: OAuthClient;
  private httpServer: http.Server | null = null;
  private pendingAuthorizations: Map<string, PendingAuthorization> = new Map();

  constructor() {
    this.oauthClient = new OAuthClient();
  }

  private getAvailableTools(): ToolInfo[] {
    return [
      {
        name: forestInfoTool.name,
        description: forestInfoTool.description || '',
        inputSchema: forestInfoTool.inputSchema,
      },
      {
        name: forestAuthenticateTool.name,
        description: forestAuthenticateTool.description || '',
        inputSchema: forestAuthenticateTool.inputSchema,
      },
    ];
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

  /**
   * Handle OAuth authorization endpoint
   * This proxies to the Forest Admin agent's authentication endpoint
   */
  private handleOAuthAuthorize(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    query: url.URLSearchParams,
  ): void {
    const clientId = query.get('client_id') || 'mcp-client';
    const redirectUri = query.get('redirect_uri');
    const state = query.get('state') || '';
    const scope = query.get('scope') || 'openid profile email';
    const codeChallenge = query.get('code_challenge') || undefined;

    if (!redirectUri) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'invalid_request', error_description: 'Missing redirect_uri' }),
      );

      return;
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');

    // Store pending authorization (expires in 10 minutes)
    this.pendingAuthorizations.set(code, {
      code,
      request: { clientId, redirectUri, state, codeChallenge, scope },
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean up expired authorizations
    for (const [key, value] of this.pendingAuthorizations.entries()) {
      if (value.expiresAt < Date.now()) {
        this.pendingAuthorizations.delete(key);
      }
    }

    // Redirect to Forest Admin agent for authentication
    const agentAuthUrl = new URL(
      '/authentication/mcp-login',
      process.env.FOREST_URL?.replace('https://api', 'https://app') ||
        'https://app.forestadmin.com',
    );
    agentAuthUrl.searchParams.set('state', code); // Use code as state for tracking
    agentAuthUrl.searchParams.set('redirect_uri', redirectUri || 'http://localhost:3931/callback');

    res.writeHead(302, { Location: agentAuthUrl.toString() });
    res.end();
  }

  /**
   * Handle OAuth token endpoint
   * Exchange authorization code for access token
   */
  private async handleOAuthToken(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const params = new url.URLSearchParams(body);
        console.log('herrrrre', params.toString());
        const grantType = params.get('grant_type');
        const codeWithState = params.get('code');
        const state = params.get('state');
        const redirectUri = params.get('redirect_uri');

        if (grantType !== 'authorization_code') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'unsupported_grant_type',
              error_description: 'Only authorization_code is supported',
            }),
          );

          return;
        }

        if (!codeWithState) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing code' }));

          return;
        }

        const { code, renderingId } = JSON.parse(codeWithState);
        const callbackUrl = new URL(
          `${this.oauthClient.getAgentHostname()}/forest/authentication/callback`,
        );
        callbackUrl.searchParams.set('code', code);
        callbackUrl.searchParams.set('state', JSON.stringify({ renderingId }));
        console.log(
          'this.oauthClient.getAgentHostname()',
          this.oauthClient.getAgentHostname(),
          callbackUrl,
        );
        const response = await fetch(callbackUrl, { method: 'GET' });
        console.log('response', response);
        const data = (await response.json()) as {
          token: string;
          tokenData: {
            id: number;
            email: string;
            firstName: string;
            lastName: string;
            team: string;
            role: string;
            permissionLevel: string;
            renderingId: string;
            tags: Record<string, string>;
            iat: number;
            exp: number;
          };
        };
        console.log(data);

        // Look up pending authorization
        // const pending = this.pendingAuthorizations.get(code);

        // console.log('code', pending);

        // if (!pending || pending.expiresAt < Date.now()) {
        //   res.writeHead(400, { 'Content-Type': 'application/json' });
        //   res.end(
        //     JSON.stringify({
        //       error: 'invalid_grant',
        //       error_description: 'Invalid or expired authorization code',
        //     }),
        //   );

        //   return;
        // }

        // if (redirectUri && pending.request.redirectUri !== redirectUri) {
        //   res.writeHead(400, { 'Content-Type': 'application/json' });
        //   res.end(
        //     JSON.stringify({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }),
        //   );

        //   return;
        // }

        // // Remove used authorization code
        // this.pendingAuthorizations.delete(code);

        // // Generate access token
        // const accessToken = crypto.randomBytes(32).toString('hex');

        // Return token response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // res.end(JSON.stringify(data));
        res.end(
          JSON.stringify({
            access_token: data.token,
            token_type: 'Bearer',
            expires_in: data.tokenData.exp - data.tokenData.iat,
            scope: 'openid profile email',
          }),
        );
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'server_error', error_description: 'Internal server error' }),
        );
      }
    });
  }

  /**
   * Handle OAuth userinfo endpoint
   * Returns information about the authenticated user
   */
  private handleOAuthUserInfo(req: http.IncomingMessage, res: http.ServerResponse): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_token',
          error_description: 'Missing or invalid authorization header',
        }),
      );

      return;
    }

    // In a real implementation, you would validate the token and look up the user
    // For now, return user info from the OAuth client if authenticated
    if (this.oauthClient.isAuthenticated()) {
      const user = this.oauthClient.getCurrentUser();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          sub: user?.id.toString(),
          email: user?.email,
          name: `${user?.firstName} ${user?.lastName}`,
          given_name: user?.firstName,
          family_name: user?.lastName,
        }),
      );
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_token',
          error_description: 'Token not associated with authenticated user',
        }),
      );
    }
  }

  /**
   * Handle JWKS endpoint
   * Returns JSON Web Key Set for token verification
   */
  private handleJwks(res: http.ServerResponse): void {
    // In a real implementation, you would generate and return actual JWKs
    // For now, return an empty key set
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        keys: [],
      }),
    );
  }

  async run(): Promise<void> {
    try {
      // Initialize OAuth client
      await this.oauthClient.initialize();

      const port = Number(process.env.MCP_SERVER_PORT) || 3931;

      // Create HTTP server
      this.httpServer = http.createServer(async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();

          return;
        }

        const { pathname, query: queryParams } = url.parse(req.url || '', true);

        // OIDC discovery endpoint
        if (pathname === '/.well-known/openid-configuration') {
          const baseUrl = `http://localhost:${port}`;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              issuer: baseUrl,
              authorization_endpoint: `${baseUrl}/oauth/authorize`,
              token_endpoint: `${baseUrl}/oauth/token`,
              userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
              jwks_uri: `${baseUrl}/.well-known/jwks.json`,
              response_types_supported: ['code'],
              subject_types_supported: ['public'],
              id_token_signing_alg_values_supported: ['RS256'],
              scopes_supported: ['openid', 'profile', 'email'],
              token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
              claims_supported: ['sub', 'email', 'name', 'given_name', 'family_name'],
              code_challenge_methods_supported: ['S256'],
            }),
          );

          return;
        }

        // JWKS endpoint
        if (pathname === '/.well-known/jwks.json') {
          this.handleJwks(res);

          return;
        }

        // OAuth authorization endpoint
        if (pathname === '/oauth/authorize' && req.method === 'GET') {
          const query = new url.URLSearchParams(queryParams as Record<string, string>);

          this.handleOAuthAuthorize(req, res, query);

          return;
        }

        // OAuth token endpoint
        if (pathname === '/oauth/token' && req.method === 'POST') {
          await this.handleOAuthToken(req, res);

          return;
        }

        // OAuth userinfo endpoint
        if (pathname === '/oauth/userinfo' && req.method === 'GET') {
          this.handleOAuthUserInfo(req, res);

          return;
        }

        // Health check endpoint
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'healthy',
              authenticated: this.oauthClient.isAuthenticated(),
              agentHostname: this.oauthClient.getAgentHostname(),
            }),
          );

          return;
        }

        // List available tools
        if (req.url === '/tools' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ tools: this.getAvailableTools() }));

          return;
        }

        // Execute a tool
        if (req.url === '/tools/execute' && req.method === 'POST') {
          let body = '';

          req.on('data', chunk => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              const request = JSON.parse(body) as { tool: string; args?: Record<string, unknown> };
              const result = await this.handleToolCall(request.tool, request.args || {});

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
          });

          return;
        }

        // Default response
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Not found',
            endpoints: {
              'GET /health': 'Health check endpoint',
              'GET /tools': 'List available tools',
              'POST /tools/execute': 'Execute a tool (body: { tool: string, args?: object })',
            },
          }),
        );
      });

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
        console.log(`[INFO] OAuth/OIDC Endpoints:`);
        // eslint-disable-next-line no-console
        console.log(
          `[INFO]   - Discovery: http://localhost:${port}/.well-known/openid-configuration`,
        );
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - JWKS: http://localhost:${port}/.well-known/jwks.json`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Authorize: http://localhost:${port}/oauth/authorize`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - Token: http://localhost:${port}/oauth/token`);
        // eslint-disable-next-line no-console
        console.log(`[INFO]   - UserInfo: http://localhost:${port}/oauth/userinfo`);
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
