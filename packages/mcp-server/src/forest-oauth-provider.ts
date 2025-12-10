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

import createForestAdminClient, { ForestAdminClient } from '@forestadmin/forestadmin-client';
import {
  CustomOAuthError,
  InvalidClientError,
  InvalidRequestError,
  InvalidTokenError,
  UnsupportedTokenTypeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import jsonwebtoken from 'jsonwebtoken';

export interface ForestAdminOAuthProviderOptions {
  forestServerUrl: string;
  envSecret: string;
  authSecret: string;
}

/**
 * OAuth Server Provider that integrates with Forest Admin authentication
 */
export default class ForestAdminOAuthProvider implements OAuthServerProvider {
  private forestServerUrl: string;
  private envSecret: string;
  private authSecret: string;
  private environmentId?: number;
  private forestAdminClient: ForestAdminClient;
  private environmentApiEndpoint: string;

  constructor({ forestServerUrl, envSecret, authSecret }: ForestAdminOAuthProviderOptions) {
    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
    this.authSecret = authSecret;
    this.forestAdminClient = createForestAdminClient({
      forestServerUrl: this.forestServerUrl,
      envSecret: this.envSecret,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.fetchEnvironmentId();
    } catch (error) {
      // Log warning but don't throw - the MCP server can still partially function
      // The authorize method will return an appropriate error when environmentId is missing
      console.error('[WARN] Failed to fetch environmentId from Forest Admin API:', error);
    }
  }

  private async fetchEnvironmentId(): Promise<void> {
    if (!this.envSecret) {
      throw new Error('FOREST_ENV_SECRET is required to fetch environment ID');
    }

    // Call Forest Admin API to get environment information
    const response = await fetch(`${this.forestServerUrl}/liana/environment`, {
      method: 'GET',
      headers: {
        'forest-secret-key': this.envSecret,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch environment from Forest Admin API: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as unknown as {
      data: { id: string; attributes: { api_endpoint: string } };
    };

    this.environmentId = parseInt(data.data.id, 10);
    this.environmentApiEndpoint = data.data.attributes.api_endpoint;
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
      // Ensure environmentId is available
      if (!this.environmentId) {
        throw new Error(
          'Environment ID not available. Make sure initialize() was called and the Forest Admin API is reachable.',
        );
      }

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

      if (params.resource?.href) {
        agentAuthUrl.searchParams.set('resource', params.resource.href);
      }

      agentAuthUrl.searchParams.set('environmentId', this.environmentId.toString());

      res.redirect(agentAuthUrl.toString());
    } catch (error) {
      console.error('[ForestAdminOAuthProvider] Authorization error:', error);
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
    try {
      return await this.generateAccessToken(client, {
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: redirectUri,
        client_id: client.client_id,
        code_verifier: codeVerifier,
      });
    } catch (error) {
      throw new InvalidRequestError(`Failed to exchange authorization code: ${error.message}`);
    }
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
  ): Promise<OAuthTokens> {
    // Verify and decode the refresh token
    let decoded: {
      type: string;
      clientId: string;
      userId: number;
      renderingId: number;
      serverRefreshToken: string;
    };

    try {
      decoded = jsonwebtoken.verify(refreshToken, this.authSecret) as typeof decoded;
    } catch (error) {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }

    // Validate token type
    if (decoded.type !== 'refresh') {
      throw new UnsupportedTokenTypeError('Invalid token type');
    }

    // Validate client_id matches
    if (decoded.clientId !== client.client_id) {
      throw new InvalidClientError('Token was not issued to this client');
    }

    // Exchange the Forest refresh token for new tokens
    try {
      return await this.generateAccessToken(client, {
        grant_type: 'refresh_token',
        refresh_token: decoded.serverRefreshToken,
        client_id: client.client_id,
        scopes,
      });
    } catch (error) {
      throw new InvalidRequestError(`Failed to refresh token: ${error.message}`);
    }
  }

  private async generateAccessToken(
    client: OAuthClientInformationFull,
    tokenPayload: Record<string, unknown>,
  ): Promise<OAuthTokens> {
    const response = await fetch(`${this.forestServerUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'forest-secret-key': this.envSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenPayload),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new CustomOAuthError(
        errorBody.error || 'server_error',
        errorBody.error_description || 'Failed to exchange authorization code',
      );
    }

    const { access_token: forestServerAccessToken, refresh_token: forestServerRefreshToken } =
      (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
        scope: string;
      };

    // Get updated user info
    const {
      meta: { renderingId },
      exp: expirationDate,
      scope,
    } = jsonwebtoken.decode(forestServerAccessToken) as {
      meta: { renderingId: number };
      exp: number;
      iat: number;
      scope: string;
    };
    const { exp: refreshTokenExpirationDate } = jsonwebtoken.decode(forestServerRefreshToken) as {
      exp: number;
      iat: number;
    };
    const user = await this.forestAdminClient.authService.getUserInfo(
      renderingId,
      forestServerAccessToken,
    );

    // Create new access token
    const expiresIn = expirationDate - Math.floor(Date.now() / 1000);
    const accessToken = jsonwebtoken.sign(
      { ...user, serverToken: forestServerAccessToken },
      this.authSecret,
      { expiresIn },
    );

    // Create new refresh token (token rotation for security)
    const refreshToken = jsonwebtoken.sign(
      {
        type: 'refresh',
        clientId: client.client_id,
        userId: user.id,
        renderingId,
        serverRefreshToken: forestServerRefreshToken,
      },
      this.authSecret,
      { expiresIn: refreshTokenExpirationDate - Math.floor(Date.now() / 1000) },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn > 0 ? expiresIn : 3600,
      refresh_token: refreshToken,
      scope: scope || client.scope,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const decoded = jsonwebtoken.verify(token, this.authSecret) as {
        id: number;
        email: string;
        renderingId: number;
        serverToken: string;
        exp: number;
        iat: number;
      };

      // Ensure this is an access token (not a refresh token)
      if ('type' in decoded && (decoded as { type?: string }).type === 'refresh') {
        throw new UnsupportedTokenTypeError('Cannot use refresh token as access token');
      }

      return {
        token,
        clientId: decoded.id.toString(),
        expiresAt: decoded.exp,
        scopes: ['mcp:read', 'mcp:write', 'mcp:action'],
        extra: {
          userId: decoded.id,
          email: decoded.email,
          renderingId: decoded.renderingId,
          environmentApiEndpoint: this.environmentApiEndpoint,
          forestServerToken: decoded.serverToken,
        },
      };
    } catch (error) {
      console.error('Error verifying token:', error);

      if (error instanceof jsonwebtoken.TokenExpiredError) {
        throw new InvalidTokenError('Access token has expired');
      }

      if (error instanceof jsonwebtoken.JsonWebTokenError) {
        throw new InvalidTokenError('Invalid access token');
      }

      throw error;
    }
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
