import { OAuthInvalidGrantError, OAuthRefreshError } from '../../src/errors';
import refreshAccessToken from '../../src/oauth/refresh-grant';

function mockResponse(options: {
  ok: boolean;
  status: number;
  payload?: unknown;
  nonJson?: boolean;
}) {
  return {
    ok: options.ok,
    status: options.status,
    json: options.nonJson
      ? () => Promise.reject(new Error('not json'))
      : () => Promise.resolve(options.payload ?? {}),
  } as unknown as Response;
}

describe('refreshAccessToken', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function lastRequest() {
    const [url, init] = fetchSpy.mock.calls[0];
    const body = init.body as URLSearchParams;

    return { url, headers: init.headers as Record<string, string>, body };
  }

  it('posts a refresh_token grant with the refresh token to the token endpoint', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { access_token: 'at' } }),
    );

    await refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' });

    const { url, body, headers } = lastRequest();
    expect(url).toBe('https://idp/token');
    expect(fetchSpy.mock.calls[0][1].method).toBe('POST');
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-1');
  });

  it('throws OAuthRefreshError (not a TypeError) when the token endpoint body is literal null', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve(null),
    } as unknown as Response);

    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' }),
    ).rejects.toBeInstanceOf(OAuthRefreshError);
  });

  it('sends client credentials via Basic auth for client_secret_basic (the default with a secret)', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { access_token: 'at' } }),
    );

    await refreshAccessToken({
      tokenEndpoint: 'https://idp/token',
      refreshToken: 'rt-1',
      clientId: 'cid',
      clientSecret: 'secret',
    });

    const { headers, body } = lastRequest();
    expect(headers.authorization).toBe(`Basic ${Buffer.from('cid:secret').toString('base64')}`);
    expect(body.get('client_secret')).toBeNull();
  });

  it('sends client credentials in the body for client_secret_post', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { access_token: 'at' } }),
    );

    await refreshAccessToken({
      tokenEndpoint: 'https://idp/token',
      refreshToken: 'rt-1',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenEndpointAuthMethod: 'client_secret_post',
    });

    const { headers, body } = lastRequest();
    expect(headers.authorization).toBeUndefined();
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('secret');
  });

  it('sends only client_id for a public client (no secret)', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { access_token: 'at' } }),
    );

    await refreshAccessToken({
      tokenEndpoint: 'https://idp/token',
      refreshToken: 'rt-1',
      clientId: 'cid',
    });

    const { headers, body } = lastRequest();
    expect(headers.authorization).toBeUndefined();
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBeNull();
  });

  it('includes the scope parameter only when scopes are provided', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { access_token: 'at' } }),
    );

    await refreshAccessToken({
      tokenEndpoint: 'https://idp/token',
      refreshToken: 'rt-1',
      scopes: 'a b',
    });
    expect(lastRequest().body.get('scope')).toBe('a b');

    fetchSpy.mockClear();
    await refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' });
    expect(lastRequest().body.get('scope')).toBeNull();
  });

  it('returns the access token, expiry, and a rotated refresh token on success', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        payload: { access_token: 'at-1', expires_in: 3600, refresh_token: 'rt-2' },
      }),
    );

    const result = await refreshAccessToken({
      tokenEndpoint: 'https://idp/token',
      refreshToken: 'rt-1',
    });

    expect(result).toEqual({ accessToken: 'at-1', expiresInS: 3600, refreshToken: 'rt-2' });
  });

  it('leaves expiresInS undefined when the response omits expires_in', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { access_token: 'at-1' } }),
    );

    const result = await refreshAccessToken({
      tokenEndpoint: 'https://idp/token',
      refreshToken: 'rt-1',
    });

    expect(result.expiresInS).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
  });

  it('throws OAuthInvalidGrantError when the endpoint returns error invalid_grant', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: false, status: 400, payload: { error: 'invalid_grant' } }),
    );

    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' }),
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError);
  });

  it('throws OAuthRefreshError for a non-invalid_grant error response', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: false, status: 400, payload: { error: 'invalid_client' } }),
    );

    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' }),
    ).rejects.toBeInstanceOf(OAuthRefreshError);
  });

  it('throws OAuthRefreshError on a 5xx from the token endpoint', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ ok: false, status: 503, nonJson: true }));

    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' }),
    ).rejects.toBeInstanceOf(OAuthRefreshError);
  });

  it('throws OAuthRefreshError when the endpoint is unreachable', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' }),
    ).rejects.toBeInstanceOf(OAuthRefreshError);
  });

  it('throws OAuthRefreshError when a 200 response carries no access_token', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: true, status: 200, payload: { token_type: 'bearer' } }),
    );

    await expect(
      refreshAccessToken({ tokenEndpoint: 'https://idp/token', refreshToken: 'rt-1' }),
    ).rejects.toBeInstanceOf(OAuthRefreshError);
  });
});
