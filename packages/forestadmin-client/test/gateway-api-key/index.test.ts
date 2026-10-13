import {
  GatewayApiKeyClient,
  GatewayApiKeyResolveError,
  parseGatewayApiKey,
} from '../../src/gateway-api-key';

const KEY_ID = 'a'.repeat(16);
const SECRET = 'b'.repeat(64);
const OPTS = {
  forestServerUrl: 'https://api.forestadmin.com',
  envSecret: 'env-secret',
  service: 'mcp' as const,
};
const PARSED = { keyId: KEY_ID, secret: SECRET };

const USER = {
  id: 1,
  email: 'a@b.c',
  firstName: 'A',
  lastName: 'B',
  team: 'T',
  tags: [{ key: 'k', value: 'v' }],
  permissionLevel: 'user',
};

const IDENTITY = { user: USER, renderingId: 17, saasAccessToken: 'saas-token' };

function fakeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

const originalFetch = global.fetch;

function mockFetch(impl: jest.Mock): void {
  global.fetch = impl as unknown as typeof fetch;
}

describe('parseGatewayApiKey', () => {
  it.each(['fgw', 'fbff'])('should parse a %s_ key into its keyId and secret', prefix => {
    expect(parseGatewayApiKey(`${prefix}_${KEY_ID}_${SECRET}`)).toEqual(PARSED);
  });

  it.each([
    ['another prefix', `fxx_${KEY_ID}_${SECRET}`],
    ['no prefix', `${KEY_ID}_${SECRET}`],
    ['a short keyId', `fgw_${'a'.repeat(15)}_${SECRET}`],
    ['a short secret', `fgw_${KEY_ID}_${'b'.repeat(63)}`],
    ['uppercase hex', `fgw_${'A'.repeat(16)}_${SECRET}`],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.sig'],
    ['an empty string', ''],
  ])('should return null for %s', (_, raw) => {
    expect(parseGatewayApiKey(raw)).toBeNull();
  });
});

describe('GatewayApiKeyClient.resolve', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should POST the key and the service to the resolve endpoint with the env secret', async () => {
    const fetchMock = jest.fn(async () => fakeResponse(200, IDENTITY));
    mockFetch(fetchMock);

    await new GatewayApiKeyClient(OPTS).resolve(PARSED);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.forestadmin.com/liana/v1/bff-api-keys/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'forest-secret-key': 'env-secret',
        },
        body: JSON.stringify({ keyId: KEY_ID, secret: SECRET, service: 'mcp' }),
      }),
    );
  });

  it('should return the identity on 200', async () => {
    mockFetch(jest.fn(async () => fakeResponse(200, IDENTITY)));

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).resolves.toEqual(IDENTITY);
  });

  it('should drop fields the identity does not declare', async () => {
    mockFetch(jest.fn(async () => fakeResponse(200, { ...IDENTITY, allowedOrigins: ['x'] })));

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).resolves.toEqual(IDENTITY);
  });

  it('should accept an identity without allowedOrigins nor saasAccessToken', async () => {
    mockFetch(jest.fn(async () => fakeResponse(200, { user: USER, renderingId: 17 })));

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).resolves.toEqual({
      user: USER,
      renderingId: 17,
      saasAccessToken: undefined,
    });
  });

  it.each([
    ['missing user', { renderingId: 17 }],
    ['missing renderingId', { user: USER }],
    ['user missing tags', { user: { ...USER, tags: undefined }, renderingId: 17 }],
    ['user missing email', { user: { ...USER, email: undefined }, renderingId: 17 }],
    ['a non-string saasAccessToken', { user: USER, renderingId: 17, saasAccessToken: 1 }],
    ['a null tag', { user: { ...USER, tags: [null] }, renderingId: 17 }],
    ['a tag without value', { user: { ...USER, tags: [{ key: 'k' }] }, renderingId: 17 }],
    [
      'a tag with a non-string key',
      { user: { ...USER, tags: [{ key: 1, value: 'v' }] }, renderingId: 17 },
    ],
    ['null', null],
  ])('should throw an unreachable error on a 200 with %s', async (_, body) => {
    mockFetch(jest.fn(async () => fakeResponse(200, body)));

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).rejects.toMatchObject({
      unreachable: true,
      message:
        'Gateway API key resolve failed (unreachable: the resolve answered 200 without a valid identity)',
    });
  });

  it('should throw an unreachable error on a 200 whose body is not JSON', async () => {
    mockFetch(
      jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => {
              throw new SyntaxError('Unexpected token');
            },
          } as unknown as Response),
      ),
    );

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).rejects.toMatchObject({
      unreachable: true,
      cause: expect.any(SyntaxError),
      message: 'Gateway API key resolve failed (unreachable: Unexpected token)',
    });
  });

  it('should keep the fetch failure and its cause when fetch rejects', async () => {
    const failure = Object.assign(new TypeError('fetch failed'), {
      cause: new Error('connect ECONNREFUSED 127.0.0.1:443'),
    });
    mockFetch(
      jest.fn(async () => {
        throw failure;
      }),
    );

    const error = await new GatewayApiKeyClient(OPTS).resolve(PARSED).catch(e => e);

    expect(error).toBeInstanceOf(GatewayApiKeyResolveError);
    expect(error.unreachable).toBe(true);
    expect(error.cause).toBe(failure);
    expect(error.message).toBe(
      'Gateway API key resolve failed (unreachable: fetch failed: connect ECONNREFUSED 127.0.0.1:443)',
    );
  });

  it('should keep a timeout as the cause', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    mockFetch(
      jest.fn(async () => {
        throw timeout;
      }),
    );

    const error = await new GatewayApiKeyClient(OPTS).resolve(PARSED).catch(e => e);

    expect(error.cause).toBe(timeout);
    expect(error.message).toBe(
      'Gateway API key resolve failed (unreachable: TimeoutError: The operation was aborted due to timeout)',
    );
  });

  it('should carry the status, code and name of a refusal', async () => {
    mockFetch(
      jest.fn(async () =>
        fakeResponse(403, {
          errors: [{ name: 'ForbiddenError', meta: { code: 'plan_feature_missing' } }],
        }),
      ),
    );

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).rejects.toMatchObject({
      status: 403,
      code: 'plan_feature_missing',
      saasName: 'ForbiddenError',
      unreachable: false,
    });
  });

  it('should carry a positive integer retry-after', async () => {
    mockFetch(jest.fn(async () => fakeResponse(429, {}, { 'retry-after': '7' })));

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).rejects.toMatchObject({
      status: 429,
      retryAfter: 7,
    });
  });

  it.each(['0', '-1', '1.5', 'soon'])('should ignore a retry-after of %s', async header => {
    mockFetch(jest.fn(async () => fakeResponse(429, {}, { 'retry-after': header })));

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).rejects.toMatchObject({
      status: 429,
      retryAfter: undefined,
    });
  });

  it('should throw a refusal without a code when the error body is not JSON', async () => {
    mockFetch(
      jest.fn(
        async () =>
          ({
            ok: false,
            status: 500,
            headers: { get: () => null },
            json: async () => {
              throw new SyntaxError('Unexpected token');
            },
          } as unknown as Response),
      ),
    );

    await expect(new GatewayApiKeyClient(OPTS).resolve(PARSED)).rejects.toMatchObject({
      status: 500,
      code: undefined,
    });
  });
});

describe('GatewayApiKeyResolveError', () => {
  it.each([
    [
      { status: 403, code: 'plan_feature_missing' },
      'Gateway API key resolve failed (status 403, code plan_feature_missing)',
    ],
    [{ status: 500 }, 'Gateway API key resolve failed (status 500)'],
    [{ unreachable: true }, 'Gateway API key resolve failed (unreachable)'],
    [
      { unreachable: true, cause: 'socket hang up' },
      'Gateway API key resolve failed (unreachable: socket hang up)',
    ],
    [{}, 'Gateway API key resolve failed'],
  ])('should describe %j in its message', (params, message) => {
    expect(new GatewayApiKeyResolveError(params).message).toBe(message);
  });
});
