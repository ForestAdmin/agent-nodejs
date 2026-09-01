import type { AgentTransport } from './agent-transport';

import { HttpRequester } from '@forestadmin/agent-client';

import { streamingUnsupported } from '../http/bff-local-errors';

/** A sentinel that never reaches the network: `query` answers before any socket is opened. */
export const IN_PROCESS_AGENT_URL = 'http://in-process.agent';

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
  /**
   * Bounding the call is the implementor's duty: there is no socket to abort, so nothing here can
   * cut a hung agent handler loose. When `timeoutMs` is absent the deployment configured none —
   * apply the 10s ceiling `HttpRequester.query` always has rather than waiting forever. A dispatch
   * that fails, times out included, must reject.
   */
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
    super(bearerToken, { url: IN_PROCESS_AGENT_URL });
  }

  // No socket to stream from, and nothing in the BFF streams today. A typed 501 rather than a raw
  // Error, so the day a route does reach here the client is told what is missing instead of being
  // sent looking for a network the request never crossed.
  override async stream(): Promise<void> {
    throw streamingUnsupported('Streaming is not supported over the in-process transport');
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
    const target = InProcessRequester.toDispatchTarget(path);

    const {
      status,
      body: responseBody,
      text,
    } = await this.dispatch({
      method,
      path: target.path,
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'Content-Type': contentType ?? 'application/json',
        Accept: contentType ?? 'application/json',
      },
      query: { timezone: 'Europe/Paris', ...target.query, ...query },
      payload: body,
      timeoutMs: maxTimeAllowed ?? this.defaultTimeoutMs,
    });

    if (status >= 400) throw this.buildError(status, responseBody, text);

    return this.deserialize<Data>(responseBody, text, skipDeserialization);
  }

  /**
   * A rejection here is the agent throwing or the dispatch itself failing — never a network hop,
   * since there is none. Rethrown with the shape an agent 5xx has, so `mapAgentError` logs the real
   * cause and answers `agent_unavailable` instead of sending whoever debugs it to look for a socket.
   */
  private async dispatch(request: AgentDispatchRequest): Promise<AgentDispatchResponse> {
    try {
      return await this.dispatcher.request(request);
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error);

      throw this.buildError(500, { errors: [{ detail }] });
    }
  }

  /**
   * Callers hand over raw segments — a record id, a collection name — because `buildUrl` escapes the
   * whole path on the HTTP side, so the escaping has to happen here too. Escaping alone is not
   * enough: `escapeUrlSlug` prefixes `+?*` with a backslash, which the WHATWG parser `buildUrl`
   * feeds reads as a path separator, and that parse also resolves `..` and splits a trailing query
   * off. Running it here is what keeps a given id addressing the same record over both transports —
   * both remain wrong for those three characters, which is PRD-1124's to fix on both at once.
   */
  private static toDispatchTarget(path: string): {
    path: string;
    query: Record<string, string>;
  } {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${IN_PROCESS_URL}${HttpRequester.escapeUrlSlug(normalized)}`);

    return { path: url.pathname, query: Object.fromEntries(url.searchParams) };
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
    url: IN_PROCESS_AGENT_URL,
    createRequester: token => new InProcessRequester(token, dispatcher, timeoutMs),
  };
}
