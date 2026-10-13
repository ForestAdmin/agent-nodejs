import jsonwebtoken from 'jsonwebtoken';

import issueTokenBodySchema, {
  issueTokenQuerySchema,
} from './fixtures/forestadmin-server-oauth-route-validator-issue-token';
import ForestServerClient from '../../src/oauth/forest-server-client';

jest.mock('@forestadmin/forestadmin-client', () => ({
  __esModule: true,
  default: jest.fn(() => ({ authService: { getUserInfo: jest.fn() } })),
}));

function captureTokenRequestBody(): jest.Mock {
  const access = jsonwebtoken.sign(
    { meta: { renderingId: 17 }, exp: Math.floor(Date.now() / 1000) + 3600 },
    'irrelevant',
  );
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ access_token: access, refresh_token: 'R2' }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  return fetchMock;
}

function sentBody(fetchMock: jest.Mock): unknown {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

function sentUrl(fetchMock: jest.Mock): URL {
  return new URL(fetchMock.mock.calls[0][0]);
}

describe('Forest server /oauth/token contract', () => {
  const client = new ForestServerClient({
    forestServerUrl: 'https://api.forestadmin.com',
    envSecret: 'env-secret',
  });

  it('should send a refresh grant body the Forest server accepts', async () => {
    const fetchMock = captureTokenRequestBody();

    await client.refreshServerToken({ refreshToken: 'R1', clientId: 'client-1' });

    expect(issueTokenBodySchema.validate(sentBody(fetchMock)).error).toBeUndefined();
  });

  it('should send an authorization code body the Forest server accepts', async () => {
    const fetchMock = captureTokenRequestBody();

    await client.exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost/callback',
      clientId: 'client-1',
    });

    expect(issueTokenBodySchema.validate(sentBody(fetchMock)).error).toBeUndefined();
  });

  it.each([
    [
      'refresh',
      (c: ForestServerClient) => c.refreshServerToken({ refreshToken: 'R1', clientId: 'client-1' }),
    ],
    [
      'authorization code',
      (c: ForestServerClient) =>
        c.exchangeCode({
          code: 'code-1',
          codeVerifier: 'verifier-1',
          redirectUri: 'http://localhost/callback',
          clientId: 'client-1',
        }),
    ],
  ])(
    'should declare service=api in the query of a %s grant, never in the body',
    async (_, send) => {
      const fetchMock = captureTokenRequestBody();

      await send(client);
      const url = sentUrl(fetchMock);
      const query = Object.fromEntries(url.searchParams);

      expect(url.pathname).toBe('/oauth/token');
      expect(query).toEqual({ service: 'api' });
      expect(issueTokenQuerySchema.validate(query).error).toBeUndefined();
      expect(sentBody(fetchMock)).not.toHaveProperty('service');
      expect(issueTokenBodySchema.validate(sentBody(fetchMock)).error).toBeUndefined();
    },
  );

  it('should be rejected by the Forest server schema when client_id is missing', () => {
    const { error } = issueTokenBodySchema.validate({
      grant_type: 'refresh_token',
      refresh_token: 'R1',
    });

    expect(error?.message).toBe('"client_id" is required');
  });
});
