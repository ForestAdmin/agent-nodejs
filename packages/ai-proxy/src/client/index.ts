import type {
  AiProxyClientConfig,
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatInput,
  RemoteToolDefinition,
} from './types';

import { AiProxyClientError } from './types';

export * from './types';

const DEFAULT_TIMEOUT = 30_000;

export class AiProxyClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: AiProxyClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.fetchFn = config.fetch ?? fetch;
  }

  /**
   * Get the list of available remote tools.
   */
  async getTools(): Promise<RemoteToolDefinition[]> {
    return this.request<RemoteToolDefinition[]>({
      method: 'GET',
      path: '/remote-tools',
    });
  }

  /**
   * Send a chat message to the AI.
   *
   * @example Simple usage with a string
   * ```typescript
   * const response = await client.chat('Hello, how are you?');
   * ```
   *
   * @example Advanced usage with options
   * ```typescript
   * const response = await client.chat({
   *   messages: [{ role: 'user', content: 'Search for cats' }],
   *   tools: [...],
   *   toolChoice: 'auto',
   *   aiName: 'gpt-4',
   * });
   * ```
   */
  async chat(input: string | ChatInput): Promise<ChatCompletion> {
    const normalized: ChatInput =
      typeof input === 'string' ? { messages: [{ role: 'user', content: input }] } : input;

    const searchParams = new URLSearchParams();

    if (normalized.aiName) {
      searchParams.set('ai-name', normalized.aiName);
    }

    return this.request<ChatCompletion>({
      method: 'POST',
      path: '/ai-query',
      searchParams,
      body: {
        messages: normalized.messages,
        tools: normalized.tools,
        tool_choice: normalized.toolChoice,
      },
      auth: true,
    });
  }

  /**
   * Call a remote tool by name.
   *
   * @example
   * ```typescript
   * const result = await client.callTool('brave_search', [
   *   { role: 'user', content: 'cats' }
   * ]);
   * ```
   */
  async callTool<T = unknown>(toolName: string, inputs: ChatCompletionMessageParam[]): Promise<T> {
    const searchParams = new URLSearchParams();
    searchParams.set('tool-name', toolName);

    return this.request<T>({
      method: 'POST',
      path: '/invoke-remote-tool',
      searchParams,
      body: { inputs },
    });
  }

  private async request<T>(params: {
    method: 'GET' | 'POST';
    path: string;
    searchParams?: URLSearchParams;
    body?: unknown;
    auth?: boolean;
  }): Promise<T> {
    const { method, path, searchParams, body, auth } = params;

    let url = `${this.baseUrl}${path}`;

    if (searchParams && searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth && this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let responseBody: unknown;

        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text().catch(() => undefined);
        }

        throw new AiProxyClientError(
          `Request failed with status ${response.status}`,
          response.status,
          responseBody,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AiProxyClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProxyClientError(`Request timeout after ${this.timeout}ms`, 408);
      }

      throw new AiProxyClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        0,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createAiProxyClient(config: AiProxyClientConfig): AiProxyClient {
  return new AiProxyClient(config);
}
