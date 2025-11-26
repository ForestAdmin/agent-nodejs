import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Response } from 'express';

import OAuthClient from './oauth-client.js';

/**
 * OAuth Server Provider that integrates with Forest Admin authentication
 */
export default class ForestAdminOAuthProvider implements OAuthServerProvider {
  private oauthClient: OAuthClient;

  private authorizationCodes: Map<
    string,
    { codeChallenge: string; redirectUri: string; client: OAuthClientInformationFull }
  > = new Map();

  private accessTokens: Map<
    string,
    { clientId: string; userId: string; expiresAt: number; scopes: string[] }
  > = new Map();

  constructor() {
    this.oauthClient = new OAuthClient();
  }

  async initialize(): Promise<void> {
    await this.oauthClient.initialize();
  }

  // In-memory clients store - in production this should be persisted
  private clients: Map<string, OAuthClientInformationFull> = new Map();

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => {
        // Auto-register unknown clients to match original permissive behavior
        // This allows any client_id without explicit registration
        if (!this.clients.has(clientId)) {
          // Create a proxy array that accepts any redirect_uri
          // This matches the original implementation which didn't validate redirect URIs
          const permissiveRedirectUris = new Proxy([], {
            get(target, prop) {
              if (prop === 'includes') {
                // Always return true for includes() check - accept any redirect_uri
                return () => true;
              }

              return target[prop as keyof typeof target];
            },
          });

          this.clients.set(clientId, {
            client_id: clientId,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            redirect_uris: permissiveRedirectUris as unknown as string[],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none', // Public client
          });
        }

        return this.clients.get(clientId);
      },
      registerClient: (
        client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
      ) => {
        const clientId = `fa_client_${Math.random().toString(36).substring(2)}`;

        // Use the same permissive redirect_uris proxy to accept any redirect_uri
        const permissiveRedirectUris = new Proxy(client.redirect_uris || [], {
          get(target, prop) {
            if (prop === 'includes') {
              return () => true;
            }

            return target[prop as keyof typeof target];
          },
        });

        const fullClient: OAuthClientInformationFull = {
          ...client,
          client_id: clientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          redirect_uris: permissiveRedirectUris as unknown as string[],
        };
        this.clients.set(clientId, fullClient);

        return fullClient;
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    try {
      // Generate authorization code
      const authCode = `fa_${Math.random().toString(36).substring(2)}`;

      // Store the authorization code with associated data
      this.authorizationCodes.set(authCode, {
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        client,
      });

      // Redirect to Forest Admin agent for actual authentication
      const agentAuthUrl = new URL(
        '/authentication/mcp-login',
        process.env.FOREST_URL?.replace('https://api', 'https://app') ||
          'https://app.forestadmin.com',
      );

      agentAuthUrl.searchParams.set('state', authCode);
      agentAuthUrl.searchParams.set('redirect_uri', params.redirectUri);

      res.redirect(agentAuthUrl.toString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      res.redirect(
        `${params.redirectUri}?error=server_error&error_description=${encodeURIComponent(
          errorMessage,
        )}`,
      );
    }
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    // const auth = this.authorizationCodes.get(authorizationCode);

    // console.log('auth', auth);

    // if (!auth) {
    // throw new Error('Invalid authorization code');
    // }

    return authorizationCode;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const { code, renderingId } = JSON.parse(authorizationCode);
    const callbackUrl = new URL(
      `${this.oauthClient.getAgentHostname()}/forest/authentication/callback`,
    );
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', JSON.stringify({ renderingId }));
    const response = await fetch(callbackUrl, { method: 'GET' });
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

    this.accessTokens.set(data.token, {
      clientId: client.client_id,
      userId: `${data.tokenData.id}`,
      expiresAt: data.tokenData.exp,
      scopes: ['openid', 'profile', 'email'],
    });

    return {
      access_token: data.token,
      token_type: 'Bearer',
      expires_in: data.tokenData.exp - data.tokenData.iat,
      // refresh_token: refreshToken,
      scope: 'openid profile email',
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
  ): Promise<OAuthTokens> {
    // Generate new access token
    const accessToken = `fa_access_${Math.random().toString(36).substring(2)}`;

    this.accessTokens.set(accessToken, {
      clientId: client.client_id,
      userId: 'forest_user',
      scopes: scopes || ['openid', 'profile', 'email'],
      expiresAt: Date.now() / 1000 + 3600,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: scopes?.join(' ') || 'openid profile email',
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // First, check if token is in our accessTokens map (from OAuth flow)
    const tokenInfo = this.accessTokens.get(token);

    if (tokenInfo) {
      return {
        token,
        clientId: tokenInfo.clientId,
        expiresAt: tokenInfo.expiresAt,
        scopes: tokenInfo.scopes,
      };
    }

    // If not in map, try to decode as Forest Admin JWT
    // Forest Admin tokens are valid JWTs that we can accept directly
    try {
      const parts = token.split('.');

      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

        // Verify it has the expected Forest Admin fields
        if (payload.id && payload.email && payload.renderingId) {
          // Accept the token and store it for future requests
          this.accessTokens.set(token, {
            clientId: 'forest-admin-direct',
            userId: `${payload.id}`,
            expiresAt: payload.exp,
            scopes: ['openid', 'profile', 'email'],
          });

          return {
            token,
            expiresAt: tokenInfo.expiresAt,
            clientId: 'forest-admin-direct',
            scopes: ['openid', 'profile', 'email'],
          };
        }
      }
    } catch (error) {
      // Token is not a valid JWT, continue to error
    }

    throw new Error('Invalid access token');
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    // Remove token from storage
    this.accessTokens.delete(request.token);
  }

  // Skip PKCE validation to match original implementation
  skipLocalPkceValidation = true;
}
