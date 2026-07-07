import type { Logger } from '@forestadmin/datasource-toolkit';
import type { InProcessAgentDispatcher } from '@forestadmin/mcp-server';
import type { RequestListener } from 'http';

import inject, { type InjectOptions, type InjectPayload } from 'light-my-request';

export type InProcessRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: unknown;
  timeoutMs?: number;
};

// Superagent-shaped so agent-client's HttpRequester helpers parse it identically.
export type InProcessResponse = { status: number; body: unknown; text: string };

// Matches superagent's HTTP path, which times out after 10s (HttpRequester.query/stream).
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
 * `setHandler` is refreshed on every (re)mount, so a captured reference never goes stale.
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

    return { status: response.statusCode, body: this.parseBody(response), text: response.payload };
  }

  private async injectWithTimeout(options: InjectOptions, timeoutMs: number) {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`In-process dispatch timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([inject(this.handler as RequestListener, options), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private parseBody(response: { payload: string }): unknown {
    if (response.payload === '') return undefined;

    try {
      return JSON.parse(response.payload);
    } catch (error) {
      this.logger?.('Warn', `In-process dispatch received a non-JSON response body: ${error}`);

      return undefined;
    }
  }
}
