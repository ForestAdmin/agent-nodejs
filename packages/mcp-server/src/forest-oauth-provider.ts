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

/**
 * OAuth Server Provider that integrates with Forest Admin authentication
 */
export default class ForestAdminOAuthProvider implements OAuthServerProvider {
  private forestServerUrl: string;
  private environmentId?: number;

  constructor({ forestServerUrl }: { forestServerUrl: string }) {
    this.forestServerUrl = forestServerUrl;
  }

  async initialize(): Promise<void> {
    await this.fetchEnvironmentId();
  }

  private async fetchEnvironmentId(): Promise<void> {
    try {
      const envSecret = process.env.FOREST_ENV_SECRET;

      if (!envSecret) {
        return;
      }

      // Call Forest Admin API to get environment information
      const response = await fetch(`${this.forestServerUrl}/liana/environment`, {
        method: 'GET',
        headers: {
          'forest-secret-key': envSecret,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch environment: ${response.statusText}`);
      }

      const data = (await response.json()) as unknown as { data: { id: string } };

      this.environmentId = parseInt(data.data.id, 10);
    } catch (error) {
      console.error('[WARN] Failed to fetch environmentId from Forest Admin API:', error);
    }
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: async (clientId: string) => {
        // Call Forest Admin API to get client information
        const response = await fetch(`${this.forestServerUrl}/oauth/register/${clientId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // Return undefined if client is not found
        if (!response.ok) {
          return undefined;
        }

        // Return registered client if exists
        return response.json();
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    try {
      // Redirect to Forest Admin agent for actual authentication
      const agentAuthUrl = new URL(
        '/oauth/authorize',
        process.env.FOREST_FRONTEND_HOSTNAME || 'https://app.forestadmin.com',
      );

      agentAuthUrl.searchParams.set('redirect_uri', params.redirectUri);
      agentAuthUrl.searchParams.set('code_challenge', params.codeChallenge);
      agentAuthUrl.searchParams.set('code_challenge_method', 'S256');
      agentAuthUrl.searchParams.set('response_type', 'code');
      agentAuthUrl.searchParams.set('client_id', client.client_id);
      agentAuthUrl.searchParams.set('state', params.state);
      agentAuthUrl.searchParams.set('scope', params.scopes.join('+'));
      agentAuthUrl.searchParams.set('resource', params.resource?.href);
      agentAuthUrl.searchParams.set('environmentId', this.environmentId.toString());

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
    // This is never called but required by TS !
    return authorizationCode;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    // FIXME: To implement the exchange with Forest Admin server

    return {
      access_token: redirectUri && 'Fake token',
      token_type: 'Bearer',
      expires_in: 3600,
      // refresh_token: refreshToken,
      scope: 'mcp:read',
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
  ): Promise<OAuthTokens> {
    // Generate new access token
    // FIXME: To implement the exchange with Forest Admin server
    return {
      access_token: 'Fake token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: scopes?.join(' ') || 'mcp:read',
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // FIXME: To implement the verification with Forest Admin server

    return {
      token,
      clientId: 'fake client id',
      expiresAt: 136472874,
      scopes: ['mcp:read'],
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    // FIXME: To implement the revocation with Forest Admin server
    if (request) {
      // Remove this if
    }
  }

  // Skip PKCE validation to match original implementation
  skipLocalPkceValidation = true;
}
