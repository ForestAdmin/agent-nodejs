import type {
  AiProxyClientConfig,
  AiQueryResponse,
  ChatCompletionMessageParam,
  ChatInput,
  InvokeToolResponse,
  RemoteToolsResponse,
} from './types';

import { AiProxyClientError } from './types';

export * from './types';

const DEFAULT_TIMEOUT = 30_000;

export class AiProxyClient {
  private readonly timeout: number;
  private readonly mode: 'custom' | 'simple';

  // Custom fetch mode
  private readonly customFetch?: typeof fetch;

  // Simple mode
  private readonly baseUrl?: string;
  private readonly headers?: Record<string, string>;

  constructor(config: AiProxyClientConfig) {
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;

    if ('fetch' in config) {
      this.mode = 'custom';
      this.customFetch = config.fetch;
    } else {
      this.mode = 'simple';
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
      this.headers = config.headers;
    }
  }

  /**
   * Get the list of available remote tools.
   */
  async getTools(): Promise<RemoteToolsResponse> {
    return this.request<RemoteToolsResponse>({
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
  async chat(input: string | ChatInput): Promise<AiQueryResponse> {
    const normalized: ChatInput =
      typeof input === 'string' ? { messages: [{ role: 'user', content: input }] } : input;

    const searchParams = new URLSearchParams();

    if (normalized.aiName) {
      searchParams.set('ai-name', normalized.aiName);
    }

    return this.request<AiQueryResponse>({
      method: 'POST',
      path: '/ai-query',
      searchParams,
      body: {
        messages: normalized.messages,
        tools: normalized.tools,
        tool_choice: normalized.toolChoice,
      },
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
  async callTool<T = InvokeToolResponse>(
    toolName: string,
    inputs: ChatCompletionMessageParam[],
  ): Promise<T> {
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
  }): Promise<T> {
    const { method, path, searchParams, body } = params;

    let url = path;

    if (searchParams && searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response =
        this.mode === 'custom'
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by constructor
            await this.customFetch!(url, {
              method,
              body: body ? JSON.stringify(body) : undefined,
              signal: controller.signal,
            })
          : await fetch(`${this.baseUrl}${url}`, {
              method,
              headers: { 'Content-Type': 'application/json', ...this.headers },
              body: body ? JSON.stringify(body) : undefined,
              signal: controller.signal,
            });

      if (!response.ok) {
        let responseBody: unknown;

        try {
          responseBody = await response.json();
        } catch (jsonError) {
          try {
            responseBody = await response.text();
          } catch {
            responseBody = undefined;
          }
        }

        throw new AiProxyClientError(
          `${method} ${path} failed with status ${response.status}`,
          response.status,
          responseBody,
        );
      }

      try {
        return (await response.json()) as T;
      } catch (parseError) {
        throw new AiProxyClientError(
          `${method} ${path}: Server returned ${response.status} but response is not valid JSON`,
          response.status,
          undefined,
          parseError instanceof Error ? parseError : undefined,
        );
      }
    } catch (error) {
      if (error instanceof AiProxyClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProxyClientError(`${method} ${path} timed out after ${this.timeout}ms`, 408);
      }

      const cause = error instanceof Error ? error : undefined;
      const message = error instanceof Error ? error.message : String(error);
      throw new AiProxyClientError(
        `${method} ${path} network error: ${message}`,
        0,
        undefined,
        cause,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createAiProxyClient(config: AiProxyClientConfig): AiProxyClient {
  return new AiProxyClient(config);
}
