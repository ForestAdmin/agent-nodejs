import { AgentTimeoutError, InProcessStreamingUnsupportedError } from './errors';
import HttpRequester from './http-requester';

/** A sentinel that never reaches the network: `query` answers before any socket is opened. */
export const IN_PROCESS_AGENT_URL = 'http://in-process.agent';

/** The `code` a dispatcher sets on the rejection of a dispatch that ran out of time. */
export const AGENT_DISPATCH_TIMEOUT_CODE = 'AGENT_DISPATCH_TIMEOUT';

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
 * structurally so the agent does not have to depend on this package for six primitive fields.
 */
export interface AgentDispatcher {
  /**
   * Bounding the call is the implementor's duty: there is no socket to abort, so nothing here can
   * cut a hung agent handler loose. When `timeoutMs` is absent the deployment configured none —
   * apply the 10s ceiling `HttpRequester.query` always has rather than waiting forever. A dispatch
   * that fails, times out included, must reject; a timeout rejects with an `Error` whose `code` is
   * `AGENT_DISPATCH_TIMEOUT_CODE`, so the caller hears a timeout rather than a failure.
   */
  request(request: AgentDispatchRequest): Promise<AgentDispatchResponse>;
}

function isDispatchTimeout(error: unknown): error is Error {
  return (
    error instanceof Error && (error as { code?: unknown }).code === AGENT_DISPATCH_TIMEOUT_CODE
  );
}

/**
 * Reaches the agent through the dispatcher instead of the network, reusing `HttpRequester`'s parse
 * helpers so results and error shape stay identical to the HTTP path.
 */
export default class InProcessHttpRequester extends HttpRequester {
  constructor(
    private readonly bearerToken: string,
    private readonly dispatcher: AgentDispatcher,
    private readonly inProcessOptions: { timezone?: string; defaultTimeoutMs?: number } = {},
  ) {
    super(bearerToken, { url: IN_PROCESS_AGENT_URL, timezone: inProcessOptions.timezone });
  }

  override async stream(): Promise<void> {
    throw new InProcessStreamingUnsupportedError();
  }

  override async query<Data = unknown>({
    method,
    path,
    body,
    query,
    maxTimeAllowed,
    contentType,
    skipDeserialization,
  }: Parameters<HttpRequester['query']>[0]): Promise<Data> {
    const target = InProcessHttpRequester.toDispatchTarget(path);

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
      query: { timezone: this.timezone, ...target.query, ...query },
      payload: body,
      timeoutMs: maxTimeAllowed ?? this.inProcessOptions.defaultTimeoutMs,
    });

    if (status >= 400) throw this.buildError(status, responseBody, text);

    return this.deserialize<Data>(responseBody, text, skipDeserialization);
  }

  /**
   * A rejection here is the agent throwing or the dispatch itself failing — never a network hop,
   * since there is none. A timeout is rethrown as the `AgentTimeoutError` the HTTP path throws;
   * anything else with the shape an agent 5xx has, so a caller logs the real cause and answers that
   * the agent failed instead of sending whoever debugs it to look for a socket.
   */
  private async dispatch(request: AgentDispatchRequest): Promise<AgentDispatchResponse> {
    try {
      return await this.dispatcher.request(request);
    } catch (error) {
      if (isDispatchTimeout(error)) throw new AgentTimeoutError(error.message, request.timeoutMs);

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
   * both remain wrong for those three characters — TODO(PRD-1124), to fix on both at once.
   */
  private static toDispatchTarget(path: string): {
    path: string;
    query: Record<string, string>;
  } {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${IN_PROCESS_AGENT_URL}${HttpRequester.escapeUrlSlug(normalized)}`);

    return { path: url.pathname, query: Object.fromEntries(url.searchParams) };
  }
}
