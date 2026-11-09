import { AIToolUnprocessableError, McpConnectionError } from '../../../src/errors';
import { getZendeskConfig, validateZendeskConfig } from '../../../src/integrations/zendesk/utils';

const ADMIN_MESSAGE =
  "Zendesk refused the connector's OAuth client. An admin must update the Zendesk connector's credentials.";
const url = 'https://acme.zendesk.com/api/v2/tickets.json';

let clientNumber = 0;

function makeConfig() {
  clientNumber += 1;

  // A client of its own per test: the token cache outlives each test by design.
  return { subdomain: 'acme', clientId: `client-${clientNumber}`, clientSecret: 'secret' };
}

function tokenResponse(accessToken: string, expiresIn?: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: accessToken, expires_in: expiresIn }),
  };
}

function apiResponse(status: number) {
  return { ok: status < 400, status, statusText: 'status', json: async () => ({}) };
}

function bearer(token: string) {
  return {
    redirect: 'manual',
    headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
  };
}

describe('zendesk OAuth client authentication', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => jest.restoreAllMocks());

  describe('when a tool calls Zendesk', () => {
    it('should request a client_credentials token, then call the API with it', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));

      const response = await getZendeskConfig(config).request(url, {});

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://acme.zendesk.com/oauth/tokens', {
        redirect: 'manual',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: 'tickets:read tickets:write',
        }),
      });
      expect(fetchMock).toHaveBeenNthCalledWith(2, url, bearer('token-1'));
    });

    it('should reuse the token across separately built tool sets', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValue(apiResponse(200));

      await getZendeskConfig(config).request(url, {});
      await getZendeskConfig(config).request(url, {});

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenNthCalledWith(3, url, bearer('token-1'));
    });

    it('should request one token for concurrent calls', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValue(apiResponse(200));
      const { request } = getZendeskConfig(config);

      await Promise.all([request(url, {}), request(url, {})]);

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should request a new token once the previous one has expired', async () => {
      const config = makeConfig();
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));
      fetchMock.mockResolvedValueOnce(tokenResponse('token-2', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));
      const { request } = getZendeskConfig(config);

      await request(url, {});
      now.mockReturnValue(1_000_000 + 1800 * 1000);
      await request(url, {});

      expect(fetchMock).toHaveBeenNthCalledWith(4, url, bearer('token-2'));
    });

    it('should keep a token that comes without an expiry', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1'));
      fetchMock.mockResolvedValue(apiResponse(200));
      const { request } = getZendeskConfig(config);

      await request(url, {});
      await request(url, {});

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should get one new token and retry once after a 401', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(401));
      fetchMock.mockResolvedValueOnce(tokenResponse('token-2', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));

      const response = await getZendeskConfig(config).request(url, {});

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenNthCalledWith(4, url, bearer('token-2'));
    });

    it('should tell an admin to update the connector when the retry gets a 401 too', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(401));
      fetchMock.mockResolvedValueOnce(tokenResponse('token-2', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(401));

      await expect(getZendeskConfig(makeConfig()).request(url, {})).rejects.toThrow(
        new AIToolUnprocessableError(ADMIN_MESSAGE),
      );
    });

    it.each([400, 401, 403])(
      'should tell an admin to update the connector when the token request gets a %i',
      async status => {
        fetchMock.mockResolvedValueOnce(apiResponse(status));

        await expect(getZendeskConfig(makeConfig()).request(url, {})).rejects.toThrow(
          new AIToolUnprocessableError(ADMIN_MESSAGE),
        );
      },
    );

    it('should not blame the credentials when Zendesk is unavailable', async () => {
      fetchMock.mockResolvedValueOnce(apiResponse(503));

      await expect(getZendeskConfig(makeConfig()).request(url, {})).rejects.toThrow(
        new AIToolUnprocessableError('Zendesk token request failed (503)'),
      );
    });

    it('should request a token again after a failed token request', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(apiResponse(503));
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));
      const { request } = getZendeskConfig(config);

      await expect(request(url, {})).rejects.toThrow(AIToolUnprocessableError);
      await expect(request(url, {})).resolves.toMatchObject({ status: 200 });
    });

    it('should not share a token between two secrets of the same client', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));
      fetchMock.mockResolvedValueOnce(tokenResponse('token-2', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));

      await getZendeskConfig(config).request(url, {});
      await getZendeskConfig({ ...config, clientSecret: 'rotated' }).request(url, {});

      expect(fetchMock).toHaveBeenNthCalledWith(4, url, bearer('token-2'));
    });
  });

  describe('when validating the configuration', () => {
    it('should accept a client Zendesk issues a token to, without calling the API', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));

      await expect(validateZendeskConfig(makeConfig())).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should refuse a client Zendesk refuses', async () => {
      fetchMock.mockResolvedValueOnce(apiResponse(401));

      await expect(validateZendeskConfig(makeConfig())).rejects.toThrow(
        new McpConnectionError(`Failed to validate Zendesk config: ${ADMIN_MESSAGE}`),
      );
    });

    it('should ask Zendesk again rather than trust a cached token', async () => {
      const config = makeConfig();
      fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 1800));
      fetchMock.mockResolvedValueOnce(apiResponse(200));
      fetchMock.mockResolvedValueOnce(apiResponse(401));

      await getZendeskConfig(config).request(url, {});

      await expect(validateZendeskConfig(config)).rejects.toThrow(McpConnectionError);
    });
  });

  describe('with an API token', () => {
    it('should keep calling the API with Basic authentication and no token request', async () => {
      fetchMock.mockResolvedValueOnce(apiResponse(200));
      const auth = Buffer.from('agent@test.com/token:abc').toString('base64');

      await getZendeskConfig({
        subdomain: 'acme',
        email: 'agent@test.com',
        apiToken: 'abc',
      }).request(url, {});

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(url, {
        redirect: 'manual',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      });
    });
  });
});
