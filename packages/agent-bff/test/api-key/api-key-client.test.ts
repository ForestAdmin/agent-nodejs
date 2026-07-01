import ApiKeyClient from '../../src/api-key/api-key-client';

const OPTS = { forestServerUrl: 'https://api.forestadmin.com', envSecret: 'env-secret' };
const PARSED = { keyId: 'a'.repeat(16), secret: 'b'.repeat(64) };

const IDENTITY = {
  user: {
    id: 1,
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    team: 'T',
    tags: [],
    permissionLevel: 'admin',
  },
  renderingId: 17,
  allowedOrigins: ['https://x.com'],
};

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

describe('ApiKeyClient.resolveApiKey', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should POST to the resolve endpoint with the env secret header and key body', async () => {
    const fetchMock = jest.fn(async () => fakeResponse(200, IDENTITY));
    mockFetch(fetchMock);

    await new ApiKeyClient(OPTS).resolveApiKey(PARSED);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.forestadmin.com/liana/v1/bff-api-keys/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'forest-secret-key': 'env-secret' }),
        body: JSON.stringify({ keyId: PARSED.keyId, secret: PARSED.secret }),
      }),
    );
  });

  it('should return the parsed identity on 200', async () => {
    mockFetch(jest.fn(async () => fakeResponse(200, IDENTITY)));

    await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).resolves.toEqual(IDENTITY);
  });

  it.each([
    ['missing user', { renderingId: 17, allowedOrigins: [] }],
    ['missing renderingId', { user: IDENTITY.user, allowedOrigins: [] }],
    ['missing allowedOrigins', { user: IDENTITY.user, renderingId: 17 }],
    [
      'user missing tags array',
      { user: { ...IDENTITY.user, tags: undefined }, renderingId: 17, allowedOrigins: [] },
    ],
    [
      'user missing email',
      { user: { ...IDENTITY.user, email: undefined }, renderingId: 17, allowedOrigins: [] },
    ],
    ['empty object', {}],
  ])(
    'should mark the error unreachable when a 200 body is incomplete (%s)',
    async (_label, body) => {
      mockFetch(jest.fn(async () => fakeResponse(200, body)));

      await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).rejects.toMatchObject({
        name: 'ApiKeyResolveError',
        unreachable: true,
      });
    },
  );

  it.each([401, 403, 400])(
    'should throw ApiKeyResolveError carrying the SaaS status %s',
    async status => {
      mockFetch(
        jest.fn(async () =>
          fakeResponse(status, { errors: [{ name: 'X', meta: { code: 'some_code' } }] }),
        ),
      );

      await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).rejects.toMatchObject({
        name: 'ApiKeyResolveError',
        status,
        code: 'some_code',
      });
    },
  );

  it('should capture the Retry-After header on 429', async () => {
    mockFetch(jest.fn(async () => fakeResponse(429, { errors: [] }, { 'retry-after': '7' })));

    await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).rejects.toMatchObject({
      status: 429,
      retryAfter: 7,
    });
  });

  it.each([
    ['HTTP-date form', 'Wed, 21 Oct 2015 07:28:00 GMT'],
    ['negative', '-5'],
    ['fractional', '3.7'],
    ['zero', '0'],
  ])('should drop a non-usable Retry-After (%s) rather than emit it', async (_label, header) => {
    mockFetch(jest.fn(async () => fakeResponse(429, { errors: [] }, { 'retry-after': header })));

    await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).rejects.toMatchObject({
      status: 429,
      retryAfter: undefined,
    });
  });

  it('should mark the error unreachable when a 200 body is not valid JSON', async () => {
    mockFetch(
      jest.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      })),
    );

    await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).rejects.toMatchObject({
      name: 'ApiKeyResolveError',
      unreachable: true,
    });
  });

  it('should mark the error unreachable when fetch throws', async () => {
    mockFetch(
      jest.fn(async () => {
        throw new Error('network down');
      }),
    );

    await expect(new ApiKeyClient(OPTS).resolveApiKey(PARSED)).rejects.toMatchObject({
      name: 'ApiKeyResolveError',
      unreachable: true,
    });
  });
});
