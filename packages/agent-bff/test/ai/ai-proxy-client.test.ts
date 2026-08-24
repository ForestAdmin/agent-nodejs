import type { AiQueryParams } from '../../src/ai/ai-proxy-client';

import AiProxyClient, { AiProxyTimeoutError } from '../../src/ai/ai-proxy-client';

const FOREST_SERVER_URL = 'https://api.forestadmin.com';

function makeClient(timeoutMs = 120_000) {
  return new AiProxyClient({ forestServerUrl: FOREST_SERVER_URL, timeoutMs });
}

function jsonFetchResponse(status: number, body: unknown) {
  return {
    status,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => body,
  };
}

function params(overrides: Partial<AiQueryParams> = {}): AiQueryParams {
  return {
    saasAccessToken: 'saas-token',
    environmentId: 7,
    renderingId: 42,
    body: { messages: [] },
    ...overrides,
  };
}

function firstCall() {
  return (global.fetch as jest.Mock).mock.calls[0];
}

describe('AiProxyClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when the call succeeds', () => {
    beforeEach(() => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonFetchResponse(200, { choices: [] })) as unknown as typeof fetch;
    });

    it('should target the fixed ai-query path with the ai-name of this deployment', async () => {
      await makeClient().query(params());

      expect(firstCall()[0]).toBe(`${FOREST_SERVER_URL}/api/ai-proxy/ai-query?ai-name=zendesk`);
    });

    it('should send exactly the allow-listed headers, with the session token as bearer', async () => {
      await makeClient().query(params());

      expect(firstCall()[1].headers).toStrictEqual({
        Authorization: 'Bearer saas-token',
        'Content-Type': 'application/json',
        'forest-environment-id': '7',
        'forest-rendering-id': '42',
      });
    });

    it('should omit forest-environment-id when the deployment resolved none', async () => {
      await makeClient().query(params({ environmentId: undefined }));

      expect(firstCall()[1].headers).not.toHaveProperty('forest-environment-id');
    });

    it('should never send forest-project-id, which no upstream fetcher reads on this path', async () => {
      await makeClient().query(params());

      expect(firstCall()[1].headers).not.toHaveProperty('forest-project-id');
    });

    it('should serialize the body unchanged', async () => {
      const body = { messages: [{ role: 'user', content: 'hi' }], tools: [] };

      await makeClient().query(params({ body }));

      expect(JSON.parse(firstCall()[1].body)).toStrictEqual(body);
    });

    it('should return the parsed body flagged as json', async () => {
      const result = await makeClient().query(params());

      expect(result).toStrictEqual({ status: 200, body: { choices: [] }, isJson: true });
    });
  });

  describe('when the upstream answers a non-JSON body', () => {
    it('should flag it and drop the body rather than carry infrastructure html', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 403,
        headers: { get: () => 'text/html' },
        json: async () => undefined,
      }) as unknown as typeof fetch;

      const result = await makeClient().query(params());

      expect(result).toStrictEqual({ status: 403, body: undefined, isJson: false });
    });
  });

  describe('when the upstream declares json but the body cannot be parsed', () => {
    it('should report it as non-json rather than pass an empty body off as a success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }) as unknown as typeof fetch;

      const result = await makeClient().query(params());

      expect(result).toStrictEqual({ status: 200, body: undefined, isJson: false });
    });
  });

  describe('when the upstream cannot be reached', () => {
    it('should raise a timeout error on abort', async () => {
      const timeout = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      global.fetch = jest.fn().mockRejectedValue(timeout) as unknown as typeof fetch;

      await expect(makeClient().query(params())).rejects.toBeInstanceOf(AiProxyTimeoutError);
    });

    it('should raise a network error carrying no internal topology', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error('connect ECONNREFUSED 10.0.0.1:443'),
        ) as unknown as typeof fetch;

      await expect(makeClient().query(params())).rejects.toThrow(
        'The Forest server could not be reached',
      );
      await expect(makeClient().query(params())).rejects.not.toThrow('10.0.0.1');
    });
  });
});
