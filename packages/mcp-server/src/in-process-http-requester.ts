import type { InProcessAgentDispatcher } from './in-process-agent-dispatcher';

import { HttpRequester } from '@forestadmin/agent-client';

/**
 * HttpRequester that reaches the agent in-process (via the dispatcher) instead of over the network.
 * Reuses agent-client's shared parse helpers so the deserialized results and AgentHttpError shape
 * are identical to the HTTP path — keeping approval-gate detection and error handling unchanged.
 */
export default class InProcessHttpRequester extends HttpRequester {
  constructor(
    private readonly bearerToken: string,
    private readonly dispatcher: InProcessAgentDispatcher,
  ) {
    // Sentinel base url that never reaches the network: query() dispatches in-process and stream()
    // throws below, so nothing ever resolves this host.
    super(bearerToken, { url: 'http://in-process.agent' });
  }

  // CSV export is not supported in-process; throw eagerly rather than let the inherited stream()
  // fire a doomed request at the sentinel host (a ~10s hang). No MCP tool streams today.
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
