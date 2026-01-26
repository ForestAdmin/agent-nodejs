import type { AiProxyClientConfig, ChatCompletion, RemoteToolDefinition } from '../src/client';

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
  const baseUrl = 'https://my-agent.com/forest';

  const mockFetch = jest.fn();

  const createClient = (config: Partial<AiProxyClientConfig> = {}): AiProxyClient => {
    return new AiProxyClient({
      baseUrl,
      fetch: mockFetch,
      ...config,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAiProxyClient', () => {
    it('creates an AiProxyClient instance', () => {
      const client = createAiProxyClient({
        baseUrl,
        fetch: mockFetch,
      });

      expect(client).toBeInstanceOf(AiProxyClient);
    });
  });

  describe('getTools', () => {
    it('makes a GET request to /remote-tools', async () => {
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

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/remote-tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(expectedTools);
    });
  });

  describe('chat', () => {
    it('accepts a simple string input', async () => {
      const expectedResponse = {
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedResponse),
      });

      const client = createClient();
      const result = await client.chat('Hello');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/ai-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          tools: undefined,
          tool_choice: undefined,
        }),
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(expectedResponse);
    });

    it('accepts an object input with messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = createClient();
      await client.chat({
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/ai-query`,
        expect.objectContaining({
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are helpful' },
              { role: 'user', content: 'Hello' },
            ],
            tools: undefined,
            tool_choice: undefined,
          }),
        }),
      );
    });

    it('includes aiName as ai-name query parameter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = createClient();
      await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        aiName: 'gpt-4',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/ai-query?ai-name=gpt-4`,
        expect.anything(),
      );
    });

    it('includes tools and toolChoice when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = createClient();
      await client.chat({
        messages: [{ role: 'user', content: 'Search for cats' }],
        tools: [
          {
            type: 'function',
            function: { name: 'search', description: 'Search' },
          },
        ],
        toolChoice: 'auto',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/ai-query`,
        expect.objectContaining({
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
        }),
      );
    });

  });

  describe('callTool', () => {
    it('makes a POST request to /invoke-remote-tool with tool-name query param', async () => {
      const expectedResult = { result: 'search results' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedResult),
      });

      const client = createClient();
      const result = await client.callTool('brave_search', [{ role: 'user', content: 'cats' }]);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/invoke-remote-tool?tool-name=brave_search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: [{ role: 'user', content: 'cats' }] }),
          signal: expect.any(AbortSignal),
        },
      );
      expect(result).toEqual(expectedResult);
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

      await expect(client.chat('Hello')).rejects.toMatchObject({
        status: 401,
        body: { error: 'Unauthorized' },
      });
    });

    it('throws AiProxyClientError with status 404 when resource not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      const client = createClient();

      await expect(client.callTool('non_existent', [])).rejects.toMatchObject({
        status: 404,
        body: { error: 'Not found' },
      });
    });

    it('throws AiProxyClientError with status 422 on validation error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: 'Validation failed' }),
      });

      const client = createClient();

      await expect(client.chat({ messages: [] })).rejects.toMatchObject({
        status: 422,
        body: { error: 'Validation failed' },
      });
    });

    it('handles non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Not JSON')),
        text: () => Promise.resolve('Internal Server Error'),
      });

      const client = createClient();

      await expect(client.getTools()).rejects.toMatchObject({
        status: 500,
        body: 'Internal Server Error',
      });
    });

    it('throws AiProxyClientError with status 408 on timeout', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            setTimeout(() => reject(error), 10);
          }),
      );

      const client = createClient({ timeout: 5 });

      await expect(client.getTools()).rejects.toMatchObject({
        status: 408,
        message: 'GET /remote-tools timed out after 5ms',
      });
    });

    it('throws AiProxyClientError with status 0 on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

      const client = createClient();

      await expect(client.getTools()).rejects.toMatchObject({
        status: 0,
        message: 'GET /remote-tools network error: Network unreachable',
      });
    });

    it('handles non-Error exceptions in network failures', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const client = createClient();

      await expect(client.getTools()).rejects.toMatchObject({
        status: 0,
        message: 'GET /remote-tools network error: string error',
      });
    });

    it('handles error responses when both json() and text() fail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('Parse error')),
        text: () => Promise.reject(new Error('Read error')),
      });

      const client = createClient();

      await expect(client.getTools()).rejects.toMatchObject({
        status: 503,
        message: 'GET /remote-tools failed with status 503',
        body: undefined,
      });
    });

    it('throws error when successful response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
      });

      const client = createClient();

      await expect(client.getTools()).rejects.toMatchObject({
        status: 200,
        message: "GET /remote-tools: Server returned 200 but response is not valid JSON",
      });
    });

    it('preserves error cause for network errors', async () => {
      const originalError = new Error('Connection refused');
      mockFetch.mockRejectedValueOnce(originalError);

      const client = createClient();

      try {
        await client.getTools();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AiProxyClientError);
        expect((error as AiProxyClientError).cause).toBe(originalError);
      }
    });
  });

  describe('URL handling', () => {
    it('removes trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const client = createClient({ baseUrl: 'https://example.com/forest/' });
      await client.getTools();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/forest/remote-tools',
        expect.anything(),
      );
    });
  });
});
