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

  describe('when the upstream declares json in a different case', () => {
    it('should still parse it, since media types are case-insensitive', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: { get: () => 'Application/JSON; charset=utf-8' },
        json: async () => ({ choices: [] }),
      }) as unknown as typeof fetch;

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
    it('should report it as non-json and hand back the parse failure, so the caller can log it', async () => {
      const parseFailure = new SyntaxError('Unexpected token < in JSON');
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => {
          throw parseFailure;
        },
      }) as unknown as typeof fetch;

      const result = await makeClient().query(params());

      expect(result).toStrictEqual({
        status: 200,
        body: undefined,
        isJson: false,
        unparseableBodyError: parseFailure,
      });
    });
  });

  describe('when the timeout fires while the body is being read', () => {
    it('should raise a timeout error rather than report an unparseable body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => {
          throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
        },
      }) as unknown as typeof fetch;

      await expect(makeClient().query(params())).rejects.toBeInstanceOf(AiProxyTimeoutError);
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

    it('should propagate the transport error, so the caller can log the real cause', async () => {
      const transport = Object.assign(new TypeError('fetch failed'), {
        cause: new Error('connect ECONNREFUSED 10.0.0.1:443'),
      });
      global.fetch = jest.fn().mockRejectedValue(transport) as unknown as typeof fetch;

      await expect(makeClient().query(params())).rejects.toBe(transport);
    });

    it('should classify a real AbortSignal timeout reason as a timeout, not as a transport error', async () => {
      const signal = AbortSignal.timeout(1);
      await new Promise(resolve => {
        signal.addEventListener('abort', resolve);
      });
      global.fetch = jest.fn().mockRejectedValue(signal.reason) as unknown as typeof fetch;

      await expect(makeClient().query(params())).rejects.toBeInstanceOf(AiProxyTimeoutError);
    });

    it('should pass the configured timeout to the abort signal', async () => {
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      }) as unknown as typeof fetch;

      await makeClient(4321).query(params());

      expect(timeout).toHaveBeenCalledWith(4321);
      timeout.mockRestore();
    });
  });
});
