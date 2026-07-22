import type { InProcessAgentDispatcher } from './in-process-agent-dispatcher';

import { HttpRequester } from '@forestadmin/agent-client';

/**
 * HttpRequester that reaches the agent in-process (via the dispatcher) instead of over the network,
 * reusing HttpRequester's parse helpers so results and error shape stay identical to the HTTP path.
 */
export default class InProcessHttpRequester extends HttpRequester {
  constructor(
    private readonly bearerToken: string,
    private readonly dispatcher: InProcessAgentDispatcher,
  ) {
    // Sentinel host that never reaches the network: query() dispatches in-process, stream() throws.
    super(bearerToken, { url: 'http://in-process.agent' });
  }

  // CSV export is not supported in-process; throw rather than fire a doomed request at the sentinel.
  override async stream(): Promise<void> {
    throw new Error('CSV streaming is not supported over the in-process MCP transport');
  }

  override async query<Data = unknown>({
    method,
    path,
    body,
    query,
    maxTimeAllowed,
    contentType,
    skipDeserialization,
  }: {
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    maxTimeAllowed?: number;
    contentType?: 'application/json' | 'text/csv';
    skipDeserialization?: boolean;
  }): Promise<Data> {
    const {
      status,
      body: responseBody,
      text,
    } = await this.dispatcher.request({
      method,
      path,
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-Type': contentType ?? 'application/json',
        Accept: contentType ?? 'application/json',
      },
      query: { timezone: 'Europe/Paris', ...query },
      payload: body,
      timeoutMs: maxTimeAllowed,
    });

    if (status >= 400) throw this.buildError(status, responseBody, text);

    return this.deserialize<Data>(responseBody, text, skipDeserialization);
  }
}
