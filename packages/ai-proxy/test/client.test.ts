import type { AiProxyClientConfig, ChatCompletion, RemoteToolDefinition } from '../src/client';

import { AiProxyClient, AiProxyClientError, createAiProxyClient } from '../src/client';

describe('AiProxyClient', () => {
  const baseUrl = 'https://my-agent.com/forest';
  const apiKey = 'sk-test-key';

  const mockFetch = jest.fn();

  const createClient = (config: Partial<AiProxyClientConfig> = {}): AiProxyClient => {
    return new AiProxyClient({
      baseUrl,
      apiKey,
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
        apiKey,
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
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

    it('does not include Authorization header when apiKey is not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = createClient({ apiKey: undefined });
      await client.chat('Hello');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
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

    it('does not include Authorization header (no auth required)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = createClient();
      await client.callTool('test_tool', []);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
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
        message: 'Request timeout after 5ms',
      });
    });

    it('throws AiProxyClientError with status 0 on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

      const client = createClient();

      await expect(client.getTools()).rejects.toMatchObject({
        status: 0,
        message: 'Network error: Network unreachable',
      });
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
