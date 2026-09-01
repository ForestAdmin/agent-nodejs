import type { AgentTransport } from './agent-transport';

import { HttpRequester } from '@forestadmin/agent-client';

/** A sentinel that never reaches the network: `query` answers before any socket is opened. */
const IN_PROCESS_URL = 'http://in-process.agent';

export interface AgentDispatchRequest {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  headers: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface AgentDispatchResponse {
  status: number;
  body: unknown;
  text?: string;
}

/**
 * Dispatches a request into an agent living in the same process, without a socket. Declared
 * structurally so neither package has to depend on the other for six primitive fields.
 */
export interface AgentDispatcher {
  request(request: AgentDispatchRequest): Promise<AgentDispatchResponse>;
}

/**
 * Reaches the agent through the dispatcher instead of the network, reusing `HttpRequester`'s parse
 * helpers so results and error shape stay identical to the HTTP path.
 */
class InProcessRequester extends HttpRequester {
  constructor(
    private readonly bearerToken: string,
    private readonly dispatcher: AgentDispatcher,
    private readonly defaultTimeoutMs?: number,
  ) {
    super(bearerToken, { url: IN_PROCESS_URL });
  }

  // No socket to stream from, and nothing in the BFF streams today. Throw rather than fire a doomed
  // request at the sentinel host.
  override async stream(): Promise<void> {
    throw new Error('Streaming is not supported over the in-process transport');
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
      // Callers hand over raw segments — a record id, a collection name — because `buildUrl` escapes
      // the whole path on the HTTP side, and `agent-data-client` says so in a comment. Escaping the
      // same way is what keeps a given record id addressing the same record over both transports.
      path: HttpRequester.escapeUrlSlug(path.startsWith('/') ? path : `/${path}`),
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-Type': contentType ?? 'application/json',
        Accept: contentType ?? 'application/json',
      },
      query: { timezone: 'Europe/Paris', ...query },
      payload: body,
      timeoutMs: maxTimeAllowed ?? this.defaultTimeoutMs,
    });

    if (status >= 400) throw this.buildError(status, responseBody, text);

    return this.deserialize<Data>(responseBody, text, skipDeserialization);
  }
}

export interface InProcessTransportOptions {
  dispatcher: AgentDispatcher;
  timeoutMs?: number;
}

export default function createInProcessTransport({
  dispatcher,
  timeoutMs,
}: InProcessTransportOptions): AgentTransport {
  return {
    url: IN_PROCESS_URL,
    createRequester: token => new InProcessRequester(token, dispatcher, timeoutMs),
  };
}
