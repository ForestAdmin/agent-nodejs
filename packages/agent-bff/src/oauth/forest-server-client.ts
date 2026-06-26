import type { UserInfo } from '@forestadmin/forestadmin-client';

import createForestAdminClient from '@forestadmin/forestadmin-client';
import jsonwebtoken from 'jsonwebtoken';

import OAuthExchangeError from './oauth-exchange-error';

export { OAuthExchangeError };

export interface RegisteredClient {
  client_id: string;
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
}

export interface ServerTokens {
  saasAccessToken: string;
  saasRefreshToken: string;
  renderingId: number;
  expiresAt: number;
}

export interface ExchangeCodeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}

export interface ForestServerClientOptions {
  forestServerUrl: string;
  envSecret: string;
}

const DEFAULT_HEADERS = { 'Content-Type': 'application/json' } as const;

export default class ForestServerClient {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;
  private readonly forestClient: ReturnType<typeof createForestAdminClient>;

  constructor({ forestServerUrl, envSecret }: ForestServerClientOptions) {
    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
    this.forestClient = createForestAdminClient({ forestServerUrl, envSecret });
  }

  async fetchEnvironmentId(): Promise<number> {
    const response = await fetch(`${this.forestServerUrl}/liana/environment`, {
      method: 'GET',
      headers: { ...DEFAULT_HEADERS, 'forest-secret-key': this.envSecret },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch environment: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { data: { id: string } };

    return parseInt(body.data.id, 10);
  }

  async getRegisteredClient(clientId: string): Promise<RegisteredClient | undefined> {
    const response = await fetch(`${this.forestServerUrl}/oauth/register/${clientId}`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });

    if (!response.ok) return undefined;

    return response.json() as Promise<RegisteredClient>;
  }

  async exchangeCode({
    code,
    codeVerifier,
    redirectUri,
    clientId,
  }: ExchangeCodeParams): Promise<ServerTokens> {
    return this.postToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });
  }

  async refreshServerToken(saasRefreshToken: string): Promise<ServerTokens> {
    return this.postToken({
      grant_type: 'refresh_token',
      refresh_token: saasRefreshToken,
    });
  }

  private async postToken(payload: Record<string, string>): Promise<ServerTokens> {
    const response = await fetch(`${this.forestServerUrl}/oauth/token`, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'forest-secret-key': this.envSecret },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        error?: string;
        error_description?: string;
      };
      throw new OAuthExchangeError(
        errorBody.error || 'server_error',
        errorBody.error_description || 'Failed to exchange token with the Forest server',
      );
    }

    const tokens = (await response.json()) as { access_token: string; refresh_token: string };

    return ForestServerClient.toServerTokens(tokens.access_token, tokens.refresh_token);
  }

  private static toServerTokens(saasAccessToken: string, saasRefreshToken: string): ServerTokens {
    const decoded = jsonwebtoken.decode(saasAccessToken) as {
      meta?: { renderingId?: number };
      exp?: number;
    } | null;

    const renderingId = decoded?.meta?.renderingId;

    if (renderingId === undefined) {
      throw new Error('Failed to decode renderingId from the Forest server access token');
    }

    return { saasAccessToken, saasRefreshToken, renderingId, expiresAt: decoded?.exp ?? 0 };
  }

  async getUserInfo(renderingId: number, saasAccessToken: string): Promise<UserInfo> {
    return this.forestClient.authService.getUserInfo(renderingId, saasAccessToken);
  }
}
