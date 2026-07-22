import type { Logger } from '@forestadmin/datasource-toolkit';
import type {
  InProcessAgentDispatcher,
  InProcessDispatchRequest,
  InProcessDispatchResponse,
} from '@forestadmin/mcp-server';
import type { RequestListener } from 'http';

import inject, { type InjectOptions, type InjectPayload } from 'light-my-request';

export type InProcessRequest = InProcessDispatchRequest;
export type InProcessResponse = InProcessDispatchResponse;

// Matches the HTTP path's 10s bound (HttpRequester.query).
const DEFAULT_TIMEOUT_MS = 10_000;

function toStringQuery(query: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) result[key] = String(value);
  }

  return result;
}

/**
 * Dispatches an agent-client request into the agent's own Koa stack in-memory (no socket), so a
 * mounted MCP server's tool calls run through the real auth/permission/logging middleware.
 */
export default class InProcessDispatcher implements InProcessAgentDispatcher {
  private handler: RequestListener | null = null;

  constructor(private readonly logger?: Logger) {}

  setHandler(handler: RequestListener | null): void {
    this.handler = handler;
  }

  async request({
    method,
    path,
    headers,
    query,
    payload,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: InProcessRequest): Promise<InProcessResponse> {
    if (!this.handler) {
      throw new Error('Cannot dispatch to the agent in-process: it is not mounted yet.');
    }

    // No socket to abort, so a hung agent handler would hang the tool call forever without this.
    const response = await this.injectWithTimeout(
      {
        method: method.toUpperCase() as InjectOptions['method'],
        url: path,
        headers,
        ...(query && { query: toStringQuery(query) }),
        ...(payload !== undefined && { payload: payload as InjectPayload }),
      },
      timeoutMs,
    );

    return {
      status: response.statusCode,
      body: this.parseBody(response.payload, response.statusCode),
      text: response.payload,
    };
  }

  private async injectWithTimeout(options: InjectOptions, timeoutMs: number) {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`In-process dispatch timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    const injection = inject(this.handler as RequestListener, options);
    // If the timeout wins the race, `injection` is left unobserved; swallow+log a late settlement so
    // a handler that rejects after the timeout can't surface as an unhandledRejection.
    injection.catch(error =>
      this.logger?.(
        'Warn',
        `In-process handler settled after the ${timeoutMs}ms timeout: ${error}`,
      ),
    );

    try {
      return await Promise.race([injection, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private parseBody(payload: string, status: number): unknown {
    if (payload === '') return undefined;

    try {
      return JSON.parse(payload);
    } catch {
      const preview = payload.length > 200 ? `${payload.slice(0, 200)}…` : payload;
      const message = `In-process dispatch received a non-JSON ${status} response body: ${preview}`;

      // A 2xx must carry a JSON:API body here; a non-JSON success body means misbehaving middleware
      // (HTML, redirect) — fail loudly rather than hand the tool `undefined`. On 4xx+ the raw text
      // is preserved by the error path (buildError falls back to parseJson(text)), so drop the body.
      if (status < 400) throw new Error(message);

      this.logger?.('Warn', message);

      return undefined;
    }
  }
}
