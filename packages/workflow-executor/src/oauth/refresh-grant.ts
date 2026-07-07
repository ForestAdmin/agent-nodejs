import { OAuthInvalidGrantError, OAuthRefreshError } from '../errors';
import assertSafeTokenEndpoint from './token-endpoint-url';

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

// RFC 6749 §2.3.1 form-url-encodes the client id/secret before base64 (space → '+', unlike
// encodeURIComponent's '%20'); identical for the base64url/hex credentials providers actually issue.
function formUrlEncode(value: string): string {
  const params = new URLSearchParams();
  params.set('v', value);

  return params.toString().slice('v='.length);
}

// Some providers return expires_in as a numeric string; coerce it so the token is still cached
// (an unusable value leaves it uncached, forcing a full refresh — and rotation — on every call).
function coerceExpiresInS(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);

  return undefined;
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
      const credentials = `${formUrlEncode(clientId ?? '')}:${formUrlEncode(clientSecret)}`;
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
  // Defense in depth: deposit validation rejects SSRF-prone endpoints, but a row predating that
  // validation could still carry one — re-check before the outbound POST. Throws (terminal) rather
  // than reaching the network.
  assertSafeTokenEndpoint(params.tokenEndpoint);

  const { headers, body } = buildRequest(params);

  let response: Awaited<ReturnType<typeof fetch>>;

  try {
    // Never follow redirects: a 3xx to an internal host would re-send the grant body (refresh
    // token, plus the client secret in client_secret_post) there and parse its reply as a token —
    // bypassing the endpoint validation above. Any redirect is treated as a failure.
    response = await fetch(params.tokenEndpoint, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
    });
  } catch (cause) {
    throw new OAuthRefreshError('the token endpoint could not be reached', cause);
  }

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new OAuthRefreshError('the token endpoint attempted a redirect');
  }

  let payload: TokenEndpointResponse = {};

  try {
    const parsed: unknown = await response.json();
    // Ignore a non-object body (e.g. literal null), keeping the {} default so the status checks
    // below still surface a typed OAuthRefreshError.
    if (parsed && typeof parsed === 'object') payload = parsed as TokenEndpointResponse;
  } catch {
    // Non-JSON body — handled by the status checks below.
  }

  if (!response.ok) {
    // invalid_client / unauthorized_client mean the client credential itself is dead (e.g. an expired
    // secret) — non-retryable like invalid_grant, so route to re-consent instead of a doomed retry.
    if (
      payload.error === 'invalid_grant' ||
      payload.error === 'invalid_client' ||
      payload.error === 'unauthorized_client'
    ) {
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
    expiresInS: coerceExpiresInS(payload.expires_in),
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
  };
}
