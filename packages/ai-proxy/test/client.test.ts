import type { ChatCompletion, RemoteToolDefinition } from '../src/client';

import { AiProxyClient, AiProxyClientError, createAiProxyClient } from '../src/client';

describe('AiProxyClientError', () => {
  it('creates an error with correct properties', () => {
    const error = new AiProxyClientError('Test error', 404, { detail: 'Not found' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AiProxyClientError);
    expect(error.name).toBe('AiProxyClientError');
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(404);
    expect(error.body).toEqual({ detail: 'Not found' });
  });

  it('preserves cause when provided', () => {
    const cause = new Error('Original error');
    const error = new AiProxyClientError('Wrapped error', 500, undefined, cause);

    expect(error.cause).toBe(cause);
  });

  describe('error categorization helpers', () => {
    it('identifies network errors (status 0)', () => {
      const error = new AiProxyClientError('Network error', 0);

      expect(error.isNetworkError).toBe(true);
      expect(error.isClientError).toBe(false);
      expect(error.isServerError).toBe(false);
    });

    it('identifies client errors (4xx)', () => {
      const error = new AiProxyClientError('Bad request', 400);

      expect(error.isNetworkError).toBe(false);
      expect(error.isClientError).toBe(true);
      expect(error.isServerError).toBe(false);
    });

    it('identifies server errors (5xx)', () => {
      const error = new AiProxyClientError('Server error', 500);

      expect(error.isNetworkError).toBe(false);
      expect(error.isClientError).toBe(false);
      expect(error.isServerError).toBe(true);
    });

    it('does not categorize 3xx as client or server error', () => {
      const error = new AiProxyClientError('Redirect', 302);

      expect(error.isNetworkError).toBe(false);
      expect(error.isClientError).toBe(false);
      expect(error.isServerError).toBe(false);
    });
  });
});

describe('AiProxyClient', () => {
  describe('custom fetch mode', () => {
    const mockFetch = jest.fn();

    const createClient = (timeout?: number): AiProxyClient => {
      return new AiProxyClient({ fetch: mockFetch, timeout });
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('createAiProxyClient', () => {
      it('creates an AiProxyClient instance', () => {
        const client = createAiProxyClient({ fetch: mockFetch });

        expect(client).toBeInstanceOf(AiProxyClient);
      });
    });

    describe('getTools', () => {
      it('makes a GET request to /remote-tools and returns tools', async () => {
        const expectedTools: RemoteToolDefinition[] = [
          {
            name: 'brave_search',
            description: 'Search the web',
            responseFormat: 'content',
            schema: { type: 'object' },
            sourceId: 'brave',
            sourceType: 'server',
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(expectedTools),
        });

        const client = createClient();
        const result = await client.getTools();

        expect(mockFetch).toHaveBeenCalledWith('/remote-tools', {
          method: 'GET',
          body: undefined,
          signal: expect.any(AbortSignal),
        });
        expect(result).toEqual(expectedTools);
      });
    });

    describe('chat', () => {
      const validResponse: ChatCompletion = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!', refusal: null },
            finish_reason: 'stop',
          },
        ],
      } as ChatCompletion;

      it('accepts a simple string input and returns response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse),
        });

        const client = createClient();
        const result = await client.chat('Hello');

        expect(mockFetch).toHaveBeenCalledWith('/ai-query', {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
            tools: undefined,
            tool_choice: undefined,
          }),
          signal: expect.any(AbortSignal),
        });
        expect(result).toEqual(validResponse);
      });

      it('accepts an object input with messages and returns response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse),
        });

        const client = createClient();
        const result = await client.chat({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
          ],
        });

        expect(mockFetch).toHaveBeenCalledWith('/ai-query', {
          method: 'POST',
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are helpful' },
              { role: 'user', content: 'Hello' },
            ],
            tools: undefined,
            tool_choice: undefined,
          }),
          signal: expect.any(AbortSignal),
        });
        expect(result).toEqual(validResponse);
      });

      it('includes aiName as ai-name query parameter when provided', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse),
        });

        const client = createClient();
        const result = await client.chat({
          messages: [{ role: 'user', content: 'Hello' }],
          aiName: 'gpt-4',
        });

        expect(mockFetch).toHaveBeenCalledWith('/ai-query?ai-name=gpt-4', {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
            tools: undefined,
            tool_choice: undefined,
          }),
          signal: expect.any(AbortSignal),
        });
        expect(result).toEqual(validResponse);
      });

      it('does not include ai-name query parameter when aiName is empty string', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse),
        });

        const client = createClient();
        await client.chat({
          messages: [{ role: 'user', content: 'Hello' }],
          aiName: '',
        });

        expect(mockFetch).toHaveBeenCalledWith('/ai-query', {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
            tools: undefined,
            tool_choice: undefined,
          }),
          signal: expect.any(AbortSignal),
        });
      });

      it('URL-encodes special characters in aiName', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse),
        });

        const client = createClient();
        await client.chat({
          messages: [{ role: 'user', content: 'Hello' }],
          aiName: 'gpt-4o & claude',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/ai-query?ai-name=gpt-4o+%26+claude',
          expect.objectContaining({ method: 'POST' }),
        );
      });

      it('includes tools and toolChoice when provided', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validResponse),
        });

        const client = createClient();
        const result = await client.chat({
          messages: [{ role: 'user', content: 'Search for cats' }],
          tools: [
            {
              type: 'function',
              function: { name: 'search', description: 'Search' },
            },
          ],
          toolChoice: 'auto',
        });

        expect(mockFetch).toHaveBeenCalledWith('/ai-query', {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Search for cats' }],
            tools: [
              {
                type: 'function',
                function: { name: 'search', description: 'Search' },
              },
            ],
            tool_choice: 'auto',
          }),
          signal: expect.any(AbortSignal),
        });
        expect(result).toEqual(validResponse);
      });
    });

    describe('callTool', () => {
      it('makes a POST request to /invoke-remote-tool and returns result', async () => {
        const expectedResult = { result: 'search results' };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(expectedResult),
        });

        const client = createClient();
        const result = await client.callTool('brave_search', [{ role: 'user', content: 'cats' }]);

        expect(mockFetch).toHaveBeenCalledWith('/invoke-remote-tool?tool-name=brave_search', {
          method: 'POST',
          body: JSON.stringify({ inputs: [{ role: 'user', content: 'cats' }] }),
          signal: expect.any(AbortSignal),
        });
        expect(result).toEqual(expectedResult);
      });

      it('URL-encodes special characters in tool name', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

        const client = createClient();
        await client.callTool('tool/with&special=chars', []);

        expect(mockFetch).toHaveBeenCalledWith(
          '/invoke-remote-tool?tool-name=tool%2Fwith%26special%3Dchars',
          expect.objectContaining({ method: 'POST' }),
        );
      });
    });

    describe('timeout', () => {
      it('uses default timeout of 30 seconds when not specified', async () => {
        mockFetch.mockImplementation(
          () =>
            new Promise((_, reject) => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              setTimeout(() => reject(error), 50);
            }),
        );

        const client = new AiProxyClient({ fetch: mockFetch }); // No timeout specified

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.message).toBe('GET /remote-tools timed out after 30000ms');
        expect(error.status).toBe(408);
      });

      it('uses custom timeout when specified', async () => {
        mockFetch.mockImplementation(
          () =>
            new Promise((_, reject) => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              setTimeout(() => reject(error), 10);
            }),
        );

        const client = createClient(5);

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.message).toBe('GET /remote-tools timed out after 5ms');
        expect(error.status).toBe(408);
      });
    });

    describe('concurrent requests', () => {
      it('handles concurrent requests with independent abort signals', async () => {
        let resolveFirst: (value: unknown) => void;
        let resolveSecond: (value: unknown) => void;

        mockFetch
          .mockImplementationOnce(
            () =>
              new Promise(resolve => {
                resolveFirst = resolve;
              }),
          )
          .mockImplementationOnce(
            () =>
              new Promise(resolve => {
                resolveSecond = resolve;
              }),
          );

        const client = createClient();

        const promise1 = client.getTools();
        const promise2 = client.chat('Hello');

        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Resolve in reverse order to verify independence
        resolveSecond!({ ok: true, json: () => Promise.resolve({ id: 'chat-123' }) });
        resolveFirst!({ ok: true, json: () => Promise.resolve([{ name: 'tool1' }]) });

        const [tools, chat] = await Promise.all([promise1, promise2]);

        expect(tools).toEqual([{ name: 'tool1' }]);
        expect(chat).toEqual({ id: 'chat-123' });
      });
    });

    describe('error handling', () => {
      it('throws AiProxyClientError with status 401 on authentication failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        });

        const client = createClient();

        const error = (await client.chat('Hello').catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(401);
        expect(error.body).toEqual({ error: 'Unauthorized' });
        expect(error.message).toBe('POST /ai-query failed with status 401');
        expect(error.isClientError).toBe(true);
      });

      it('throws AiProxyClientError with status 404 when resource not found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        });

        const client = createClient();

        const error = (await client.callTool('non_existent', []).catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(404);
        expect(error.body).toEqual({ error: 'Not found' });
        expect(error.isClientError).toBe(true);
      });

      it('throws AiProxyClientError with status 422 on validation error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: () => Promise.resolve({ error: 'Validation failed' }),
        });

        const client = createClient();

        const error = (await client.chat({ messages: [] }).catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(422);
        expect(error.body).toEqual({ error: 'Validation failed' });
        expect(error.isClientError).toBe(true);
      });

      it('handles non-JSON error responses by falling back to text', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('Not JSON')),
          text: () => Promise.resolve('Internal Server Error'),
        });

        const client = createClient();

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(500);
        expect(error.body).toBe('Internal Server Error');
        expect(error.isServerError).toBe(true);
      });

      it('throws AiProxyClientError with status 0 on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

        const client = createClient();

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(0);
        expect(error.message).toBe('GET /remote-tools network error: Network unreachable');
        expect(error.isNetworkError).toBe(true);
      });

      it('handles non-Error exceptions in network failures', async () => {
        mockFetch.mockRejectedValueOnce('string error');

        const client = createClient();

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(0);
        expect(error.message).toBe('GET /remote-tools network error: string error');
      });

      it('handles error responses when both json() and text() fail', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.reject(new Error('Parse error')),
          text: () => Promise.reject(new Error('Read error')),
        });

        const client = createClient();

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(503);
        expect(error.message).toBe('GET /remote-tools failed with status 503');
        expect(error.body).toBeUndefined();
      });

      it('throws error when successful response is not valid JSON', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
        });

        const client = createClient();

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.status).toBe(200);
        expect(error.message).toBe('GET /remote-tools: Server returned 200 but response is not valid JSON');
      });

      it('preserves error cause for network errors', async () => {
        const originalError = new Error('Connection refused');
        mockFetch.mockRejectedValueOnce(originalError);

        const client = createClient();

        const error = (await client.getTools().catch(e => e)) as AiProxyClientError;

        expect(error).toBeInstanceOf(AiProxyClientError);
        expect(error.cause).toBe(originalError);
      });
    });
  });

  describe('simple mode', () => {
    const baseUrl = 'https://my-agent.com/forest';

    const mockFetch = jest.fn();
    const originalFetch = global.fetch;

    beforeAll(() => {
      global.fetch = mockFetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('makes requests with baseUrl and Content-Type header', async () => {
      const expectedTools: RemoteToolDefinition[] = [{ name: 'test' }] as RemoteToolDefinition[];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedTools),
      });

      const client = new AiProxyClient({ baseUrl });
      const result = await client.getTools();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/remote-tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(expectedTools);
    });

    it('removes trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = new AiProxyClient({ baseUrl: 'https://example.com/forest/' });
      await client.getTools();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/forest/remote-tools',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('includes custom headers merged with Content-Type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = new AiProxyClient({
        baseUrl,
        headers: { Authorization: 'Bearer token', 'X-Custom': 'value' },
      });
      await client.getTools();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/remote-tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
    });

    it('allows custom headers to override Content-Type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = new AiProxyClient({
        baseUrl,
        headers: { 'Content-Type': 'text/plain' },
      });
      await client.getTools();

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/remote-tools`,
        expect.objectContaining({
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    });
  });
});
