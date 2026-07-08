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
    // Base url is unused: query() is overridden to dispatch in-process.
    super(bearerToken, { url: 'http://in-process.agent' });
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
