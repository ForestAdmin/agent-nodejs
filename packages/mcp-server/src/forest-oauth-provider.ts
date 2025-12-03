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

  constructor({ forestServerUrl }: { forestServerUrl: string }) {
    this.forestServerUrl = forestServerUrl;
  }

  async initialize(): Promise<void> {
    // FIXME: Fetch environmentId on startup if needed
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => {
        // FIXME: To implement
        return clientId && null;
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // FIXME: To implement
    res.sendStatus(501);
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
