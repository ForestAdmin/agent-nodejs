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

import forestAdminClientModule, { ForestAdminClient } from '@forestadmin/forestadmin-client';
import { CustomOAuthError } from '@modelcontextprotocol/sdk/server/auth/errors';
import jsonwebtoken from 'jsonwebtoken';

// Handle ESM/CJS interop: the module may be double-wrapped with default exports
const createForestAdminClient =
  typeof forestAdminClientModule === 'function'
    ? forestAdminClientModule
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((forestAdminClientModule as any).default as typeof forestAdminClientModule);

/**
 * OAuth Server Provider that integrates with Forest Admin authentication
 */
export default class ForestAdminOAuthProvider implements OAuthServerProvider {
  private forestServerUrl: string;
  private environmentId?: number;
  private forestAdminClient: ForestAdminClient;

  constructor({ forestServerUrl }: { forestServerUrl: string }) {
    this.forestServerUrl = forestServerUrl;
    this.forestAdminClient = createForestAdminClient({
      forestServerUrl: this.forestServerUrl,
      envSecret: process.env.FOREST_ENV_SECRET,
    });
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
    const response = await fetch(`${this.forestServerUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: redirectUri,
        client_id: client.client_id,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new CustomOAuthError(
        errorBody.error || 'server_error',
        errorBody.error_description || 'Failed to exchange authorization code',
      );
    }

    const { access_token: forestServerAccessToken } = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    const {
      renderingId,
      expires_in: expiresIn,
      scope,
    } = jsonwebtoken.decode(forestServerAccessToken) as {
      renderingId: number;
      expires_in: number;
      scope: string;
    };
    const user = await this.forestAdminClient.authService.getUserInfo(
      renderingId,
      forestServerAccessToken,
    );

    const token = jsonwebtoken.sign(
      { ...user, serverToken: forestServerAccessToken },
      process.env.FOREST_AUTH_SECRET,
      { expiresIn: '1 hours' },
    );

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn || 3600,
      // refresh_token: refreshToken,
      scope: scope || client.scope,
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
