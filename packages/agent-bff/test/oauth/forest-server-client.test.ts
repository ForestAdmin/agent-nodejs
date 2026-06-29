import type { UserInfo } from '@forestadmin/forestadmin-client';

import jsonwebtoken from 'jsonwebtoken';

import ForestServerClient, { OAuthExchangeError } from '../../src/oauth/forest-server-client';

const getUserInfoSpy = jest.fn();

jest.mock('@forestadmin/forestadmin-client', () => ({
  __esModule: true,
  default: jest.fn(() => ({ authService: { getUserInfo: getUserInfoSpy } })),
}));

const SERVER_URL = 'https://api.forestadmin.com';
const ENV_SECRET = 'env-secret';

function saasAccessToken(renderingId = 17, expSecondsFromNow = 3600): string {
  return jsonwebtoken.sign(
    { meta: { renderingId }, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow },
    'irrelevant',
  );
}

function mockFetchOnce(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    statusText: 'mock',
    json: response.json ?? (async () => ({})),
  }) as unknown as typeof fetch;
}

describe('ForestServerClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when exchanging an authorization code', () => {
    it('should return the SaaS tokens with renderingId and exp decoded from the access token', async () => {
      const access = saasAccessToken(17);
      mockFetchOnce({
        ok: true,
        json: async () => ({ access_token: access, refresh_token: 'R1' }),
      });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });
      const tokens = await client.exchangeCode({
        code: 'c',
        codeVerifier: 'v',
        redirectUri: 'http://localhost/cb',
        clientId: 'client-1',
      });

      expect(tokens.saasAccessToken).toBe(access);
      expect(tokens.saasRefreshToken).toBe('R1');
      expect(tokens.renderingId).toBe(17);
      expect(tokens.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should throw OAuthExchangeError with the safe error code on a failed exchange', async () => {
      mockFetchOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', error_description: 'bad code' }),
      });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(
        client.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'x' }),
      ).rejects.toMatchObject({ error: 'invalid_grant' });
    });

    it('should throw when the exchange response omits the refresh token', async () => {
      mockFetchOnce({ ok: true, json: async () => ({ access_token: saasAccessToken(17) }) });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(
        client.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'x' }),
      ).rejects.toMatchObject({ error: 'invalid_grant' });
    });
  });

  describe('when refreshing the SaaS token', () => {
    it('should return the NEW rotated access and refresh tokens', async () => {
      const newAccess = saasAccessToken(17);
      mockFetchOnce({
        ok: true,
        json: async () => ({ access_token: newAccess, refresh_token: 'R2' }),
      });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });
      const tokens = await client.refreshServerToken('R1');

      expect(tokens.saasAccessToken).toBe(newAccess);
      expect(tokens.saasRefreshToken).toBe('R2');
      expect(tokens.renderingId).toBe(17);
    });

    it('should throw OAuthExchangeError when the SaaS refresh fails', async () => {
      mockFetchOnce({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.refreshServerToken('R1')).rejects.toBeInstanceOf(OAuthExchangeError);
    });

    it('should not require renderingId in the refresh-grant access token', async () => {
      const accessWithoutRendering = jsonwebtoken.sign(
        { exp: Math.floor(Date.now() / 1000) + 3600 },
        'irrelevant',
      );
      mockFetchOnce({
        ok: true,
        json: async () => ({ access_token: accessWithoutRendering, refresh_token: 'R2' }),
      });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.refreshServerToken('R1')).resolves.toMatchObject({
        saasRefreshToken: 'R2',
      });
    });
  });

  describe('when fetching the environment id', () => {
    it('should parse the numeric id from the Forest server response', async () => {
      mockFetchOnce({ ok: true, json: async () => ({ data: { id: '42' } }) });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.fetchEnvironmentId()).resolves.toBe(42);
    });

    it('should throw when the response is not ok', async () => {
      mockFetchOnce({ ok: false, status: 503 });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.fetchEnvironmentId()).rejects.toThrow(/Failed to fetch environment/);
    });

    it('should parse a numeric (non-string) id from the Forest server response', async () => {
      mockFetchOnce({ ok: true, json: async () => ({ data: { id: 3 } }) });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.fetchEnvironmentId()).resolves.toBe(3);
    });

    it('should throw when the id is not an integer', async () => {
      mockFetchOnce({ ok: true, json: async () => ({ data: { id: 'not-a-number' } }) });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.fetchEnvironmentId()).rejects.toThrow(/parse environment id/);
    });

    it.each([{ id: '' }, { id: null }, { id: '0' }, { id: 0 }, {}])(
      'should throw rather than coerce a malformed id (%j) to 0',
      async data => {
        mockFetchOnce({ ok: true, json: async () => ({ data }) });

        const client = new ForestServerClient({
          forestServerUrl: SERVER_URL,
          envSecret: ENV_SECRET,
        });

        await expect(client.fetchEnvironmentId()).rejects.toThrow(/parse environment id/);
      },
    );
  });

  describe('when decoding renderingId from an exchange token', () => {
    it('should throw when the authorization_code access token has no renderingId', async () => {
      const accessWithoutRendering = jsonwebtoken.sign(
        { exp: Math.floor(Date.now() / 1000) + 3600 },
        'irrelevant',
      );
      mockFetchOnce({
        ok: true,
        json: async () => ({ access_token: accessWithoutRendering, refresh_token: 'R1' }),
      });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(
        client.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'x' }),
      ).rejects.toThrow(/Failed to decode renderingId/);
    });

    it('should default renderingId to 0 on refresh when the token has none', async () => {
      const accessWithoutRendering = jsonwebtoken.sign(
        { exp: Math.floor(Date.now() / 1000) + 3600 },
        'irrelevant',
      );
      mockFetchOnce({
        ok: true,
        json: async () => ({ access_token: accessWithoutRendering, refresh_token: 'R2' }),
      });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.refreshServerToken('R1')).resolves.toMatchObject({ renderingId: 0 });
    });
  });

  describe('when looking up a registered client', () => {
    it('should return the client json on the ok path', async () => {
      const registered = { client_id: 'client-1', redirect_uris: ['http://localhost/cb'] };
      mockFetchOnce({ ok: true, json: async () => registered });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.getRegisteredClient('client-1')).resolves.toEqual(registered);
    });

    it('should return undefined on 404 (unknown client)', async () => {
      mockFetchOnce({ ok: false, status: 404 });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.getRegisteredClient('nope')).resolves.toBeUndefined();
    });

    it('should throw on a non-404 error (outage), not masquerade as unknown client', async () => {
      mockFetchOnce({ ok: false, status: 503 });

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });

      await expect(client.getRegisteredClient('client-1')).rejects.toThrow();
    });

    it('should percent-encode the clientId in the request path', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });
      await client.getRegisteredClient('../../liana/environment');

      expect(fetchMock.mock.calls[0][0]).toContain('%2F');
      expect(fetchMock.mock.calls[0][0]).not.toContain('/oauth/register/../');
    });
  });

  describe('when resolving user info', () => {
    it('should delegate to the forestadmin-client authService with the rendering id and token', async () => {
      const userInfo = { id: 7, renderingId: 17 } as unknown as UserInfo;
      getUserInfoSpy.mockResolvedValueOnce(userInfo);

      const client = new ForestServerClient({ forestServerUrl: SERVER_URL, envSecret: ENV_SECRET });
      const result = await client.getUserInfo(17, 'saas-token');

      expect(getUserInfoSpy).toHaveBeenCalledWith(17, 'saas-token');
      expect(result).toBe(userInfo);
    });
  });
});
