import type { RequestListener } from 'http';

import inject, { type InjectOptions, type InjectPayload } from 'light-my-request';

export type InProcessRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: unknown;
};

// Superagent-shaped so agent-client's HttpRequester helpers parse it identically.
export type InProcessResponse = { status: number; body: unknown; text: string };

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
export default class InProcessDispatcher {
  private handler: RequestListener | null = null;

  setHandler(handler: RequestListener | null): void {
    this.handler = handler;
  }

  async request({
    method,
    path,
    headers,
    query,
    payload,
  }: InProcessRequest): Promise<InProcessResponse> {
    if (!this.handler) {
      throw new Error('Cannot dispatch to the agent in-process: it is not mounted yet.');
    }

    const response = await inject(this.handler, {
      method: method.toUpperCase() as InjectOptions['method'],
      url: path,
      headers,
      ...(query && { query: toStringQuery(query) }),
      ...(payload !== undefined && { payload: payload as InjectPayload }),
    });

    let body: unknown;

    try {
      body = response.json();
    } catch {
      body = undefined;
    }

    return { status: response.statusCode, body, text: response.payload };
  }
}
