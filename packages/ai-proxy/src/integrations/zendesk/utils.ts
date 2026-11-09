import type { ZendeskConfig } from './tools';

import { createHash } from 'crypto';

import { AIBadRequestError, AIToolUnprocessableError, McpConnectionError } from '../../errors';
import fetchWithoutRedirect from '../fetch-without-redirect';

// A Zendesk subdomain is a single DNS label. Anything else could redirect URL building to an
// attacker-controlled host (e.g. `attack.com/x#` makes `#` start the URL fragment).
const SUBDOMAIN_RE = /^[A-Za-z0-9-]{1,63}$/;

export function assertValidSubdomain(subdomain: string): void {
  if (typeof subdomain !== 'string' || !SUBDOMAIN_RE.test(subdomain)) {
    throw new AIBadRequestError(`Invalid Zendesk subdomain: ${JSON.stringify(subdomain)}`);
  }
}

export type ZendeskRequest = (url: string, init?: RequestInit) => Promise<Response>;
type OAuthClientConfig = Extract<ZendeskConfig, { clientId: string }>;
type AccessToken = { value: string; expiresAt: number };

const TOKEN_SCOPE = 'tickets:read tickets:write';
const TOKEN_EXPIRY_MARGIN_SECONDS = 60;
const CLIENT_REFUSED_STATUSES = [400, 401, 403];
const CLIENT_REFUSED_MESSAGE =
  "Zendesk refused the connector's OAuth client. An admin must update the Zendesk connector's credentials.";

// Providers are rebuilt on every request, so the cache has to outlive them.
// ponytail: never evicted, one entry per OAuth client; add eviction if clients ever churn.
const accessTokens = new Map<string, Promise<AccessToken>>();

async function requestAccessToken(config: OAuthClientConfig): Promise<AccessToken> {
  const response = await fetchWithoutRedirect(
    `https://${config.subdomain}.zendesk.com/oauth/tokens`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: TOKEN_SCOPE,
      }),
    },
  );

  if (CLIENT_REFUSED_STATUSES.includes(response.status)) {
    throw new AIToolUnprocessableError(CLIENT_REFUSED_MESSAGE);
  }

  if (!response.ok) {
    throw new AIToolUnprocessableError(`Zendesk token request failed (${response.status})`);
  }

  const { access_token: value, expires_in: expiresIn } = await response.json();

  return {
    value,
    expiresAt: expiresIn
      ? Date.now() + (expiresIn - TOKEN_EXPIRY_MARGIN_SECONDS) * 1000
      : Number.POSITIVE_INFINITY,
  };
}

async function getAccessToken(config: OAuthClientConfig, cacheKey: string): Promise<string> {
  const cached = accessTokens.get(cacheKey);

  if (cached) {
    const token = await cached;
    if (token.expiresAt > Date.now()) return token.value;
    accessTokens.delete(cacheKey);
  }

  const pending = requestAccessToken(config).catch(error => {
    accessTokens.delete(cacheKey);
    throw error;
  });
  accessTokens.set(cacheKey, pending);

  return (await pending).value;
}

function createOAuthClientRequest(config: OAuthClientConfig): ZendeskRequest {
  const cacheKey = createHash('sha256')
    .update(JSON.stringify([config.subdomain, config.clientId, config.clientSecret]))
    .digest('hex');

  const send = async (url: string, init: RequestInit) =>
    fetchWithoutRedirect(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await getAccessToken(config, cacheKey)}`,
        'Content-Type': 'application/json',
      },
    });

  return async (url, init = {}) => {
    const response = await send(url, init);
    if (response.status !== 401) return response;

    accessTokens.delete(cacheKey);
    const retried = await send(url, init);
    if (retried.status === 401) throw new AIToolUnprocessableError(CLIENT_REFUSED_MESSAGE);

    return retried;
  };
}

function createApiTokenRequest(config: Extract<ZendeskConfig, { apiToken: string }>) {
  const auth = Buffer.from(`${config.email}/token:${config.apiToken}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  return ((url, init = {}) => fetchWithoutRedirect(url, { ...init, headers })) as ZendeskRequest;
}

export function getZendeskConfig(config: ZendeskConfig) {
  assertValidSubdomain(config.subdomain);

  return {
    baseUrl: `https://${config.subdomain}.zendesk.com/api/v2`,
    request:
      'clientId' in config ? createOAuthClientRequest(config) : createApiTokenRequest(config),
  };
}

export async function assertResponseOk(response: Response, action: string) {
  if (!response.ok) {
    let errorMessage = response.statusText || 'Unknown error';

    try {
      const json = await response.json();
      errorMessage = json.error || json.title || json.description || errorMessage;
    } catch {
      // Response body is not JSON
    }

    throw new AIToolUnprocessableError(
      `Zendesk ${action} failed (${response.status}): ${errorMessage}`,
    );
  }
}

export async function validateZendeskConfig(config: ZendeskConfig) {
  const { baseUrl, request } = getZendeskConfig(config);

  if ('clientId' in config) {
    // Bypasses the cache: a token issued earlier says nothing about the client today.
    try {
      await requestAccessToken(config);
    } catch (error) {
      throw new McpConnectionError(
        `Failed to validate Zendesk config: ${(error as Error).message}`,
      );
    }

    return;
  }

  const response = await request(`${baseUrl}/users/me`);

  if (!response.ok) {
    let errorMessage = response.statusText || 'Unknown error';

    try {
      const json = await response.json();
      errorMessage = json.title || json.error?.title || errorMessage;
    } catch {
      // Response body is not JSON (e.g. HTML from gateway timeout)
    }

    throw new McpConnectionError(`Failed to validate Zendesk config: ${errorMessage}`);
  }
}
