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
const REQUEST_TIMEOUT_MS = 60_000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export default class ForestServerClient {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;
  private readonly forestClient: ReturnType<typeof createForestAdminClient>;

  constructor({ forestServerUrl, envSecret }: ForestServerClientOptions) {
    this.forestServerUrl = forestServerUrl;
    this.envSecret = envSecret;
    this.forestClient = createForestAdminClient({ forestServerUrl, envSecret });
  }

  private url(path: string): string {
    return new URL(path, this.forestServerUrl).toString();
  }

  async fetchEnvironmentId(): Promise<number> {
    const response = await fetchWithTimeout(this.url('/liana/environment'), {
      method: 'GET',
      headers: { ...DEFAULT_HEADERS, 'forest-secret-key': this.envSecret },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch environment: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { data?: { id?: string | number } };
    const id = body.data?.id;

    if (typeof id !== 'number' && (typeof id !== 'string' || !/^\d+$/.test(id))) {
      throw new Error('Failed to parse environment id from the Forest server response');
    }

    const environmentId = Number(id);

    if (!Number.isInteger(environmentId) || environmentId <= 0) {
      throw new Error('Failed to parse environment id from the Forest server response');
    }

    return environmentId;
  }

  async getRegisteredClient(clientId: string): Promise<RegisteredClient | undefined> {
    const response = await fetchWithTimeout(
      this.url(`/oauth/register/${encodeURIComponent(clientId)}`),
      {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      },
    );

    if (response.status === 404) return undefined;

    if (!response.ok) {
      throw new Error(
        `Failed to fetch registered client: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<RegisteredClient>;
  }

  async exchangeCode({
    code,
    codeVerifier,
    redirectUri,
    clientId,
  }: ExchangeCodeParams): Promise<ServerTokens> {
    return this.postToken(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      },
      true,
    );
  }

  async refreshServerToken(saasRefreshToken: string): Promise<ServerTokens> {
    return this.postToken({ grant_type: 'refresh_token', refresh_token: saasRefreshToken }, false);
  }

  private async postToken(
    payload: Record<string, string>,
    isInitialExchange: boolean,
  ): Promise<ServerTokens> {
    const response = await fetchWithTimeout(this.url('/oauth/token'), {
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

    const tokens = (await response.json()) as { access_token: string; refresh_token?: string };
    const saasRefreshToken = tokens.refresh_token ?? payload.refresh_token;

    if (saasRefreshToken === undefined) {
      throw new OAuthExchangeError(
        'invalid_grant',
        'The Forest server did not return a refresh token',
      );
    }

    return ForestServerClient.toServerTokens(
      tokens.access_token,
      saasRefreshToken,
      isInitialExchange,
    );
  }

  private static toServerTokens(
    saasAccessToken: string,
    saasRefreshToken: string,
    requireRenderingId: boolean,
  ): ServerTokens {
    const decoded = jsonwebtoken.decode(saasAccessToken) as {
      meta?: { renderingId?: number };
      exp?: number;
    } | null;

    const decodedRenderingId = Number(decoded?.meta?.renderingId);
    const hasRenderingId = Number.isInteger(decodedRenderingId);

    if (requireRenderingId && !hasRenderingId) {
      throw new Error('Failed to decode renderingId from the Forest server access token');
    }

    return {
      saasAccessToken,
      saasRefreshToken,
      renderingId: hasRenderingId ? decodedRenderingId : 0,
      expiresAt: decoded?.exp ?? 0,
    };
  }

  async getUserInfo(renderingId: number, saasAccessToken: string): Promise<UserInfo> {
    return this.forestClient.authService.getUserInfo(renderingId, saasAccessToken);
  }
}
