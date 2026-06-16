import { OAuthInvalidGrantError, OAuthRefreshError } from '../errors';

export interface RefreshGrantParams {
  tokenEndpoint: string;
  refreshToken: string;
  clientId?: string | null;
  clientSecret?: string | null;
  tokenEndpointAuthMethod?: string | null;
  scopes?: string | null;
}

export interface RefreshGrantResult {
  accessToken: string;
  expiresInS?: number;
  // Present only when the authorization server rotates the refresh token.
  refreshToken?: string;
}

interface TokenEndpointResponse {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  error?: unknown;
  error_description?: unknown;
}

function buildRequest(params: RefreshGrantParams): {
  headers: Record<string, string>;
  body: URLSearchParams;
} {
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
  });

  if (params.scopes) body.set('scope', params.scopes);

  const { clientId, clientSecret, tokenEndpointAuthMethod } = params;

  if (clientSecret) {
    if (tokenEndpointAuthMethod === 'client_secret_post') {
      if (clientId) body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
    } else {
      const credentials = `${encodeURIComponent(clientId ?? '')}:${encodeURIComponent(
        clientSecret,
      )}`;
      headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
    }
  } else if (clientId) {
    body.set('client_id', clientId);
  }

  return { headers, body };
}

// Runs the OAuth2 refresh-token grant (RFC 6749 §6) against the stored token endpoint. Distinguishes
// a non-retryable invalid_grant (revoked / rotated) from a transient failure so the caller can decide
// between forcing re-auth and retrying.
export default async function refreshAccessToken(
  params: RefreshGrantParams,
): Promise<RefreshGrantResult> {
  const { headers, body } = buildRequest(params);

  let response: Awaited<ReturnType<typeof fetch>>;

  try {
    response = await fetch(params.tokenEndpoint, { method: 'POST', headers, body });
  } catch (cause) {
    throw new OAuthRefreshError('the token endpoint could not be reached', cause);
  }

  let payload: TokenEndpointResponse = {};

  try {
    payload = (await response.json()) as TokenEndpointResponse;
  } catch {
    // Non-JSON body — handled by the status checks below.
  }

  if (!response.ok) {
    if (payload.error === 'invalid_grant') {
      throw new OAuthInvalidGrantError(
        typeof payload.error_description === 'string' ? payload.error_description : undefined,
      );
    }

    throw new OAuthRefreshError(
      typeof payload.error === 'string'
        ? payload.error
        : `the token endpoint returned ${response.status}`,
    );
  }

  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new OAuthRefreshError('the token endpoint response had no access_token');
  }

  return {
    accessToken: payload.access_token,
    expiresInS: typeof payload.expires_in === 'number' ? payload.expires_in : undefined,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
  };
}
