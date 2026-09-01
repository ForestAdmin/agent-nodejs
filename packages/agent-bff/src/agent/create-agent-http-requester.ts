import { HttpRequester } from '@forestadmin/agent-client';

type QueryOptions = Parameters<HttpRequester['query']>[0];
type StreamOptions = Parameters<HttpRequester['stream']>[0];

export class AgentTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentTimeoutError';
  }
}

function isSuperagentTimeout(error: unknown): boolean {
  const { code, timeout } = (error ?? {}) as { code?: unknown; timeout?: unknown };

  return code === 'ECONNABORTED' && typeof timeout === 'number';
}

async function withTypedTimeout<Result>(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (error) {
    if (!isSuperagentTimeout(error)) throw error;

    throw new AgentTimeoutError(error instanceof Error ? error.message : String(error));
  }
}

export default function createAgentHttpRequester(
  token: string,
  agentUrl: string,
  timeoutMs?: number,
): HttpRequester {
  const requester = new HttpRequester(token, { url: agentUrl });
  const query = requester.query.bind(requester);
  const stream = requester.stream.bind(requester);

  requester.query = <Data = unknown>(options: QueryOptions): Promise<Data> =>
    withTypedTimeout(
      () =>
        query({ ...options, maxTimeAllowed: options.maxTimeAllowed ?? timeoutMs }) as Promise<Data>,
    );

  requester.stream = (options: StreamOptions): Promise<void> =>
    withTypedTimeout(() =>
      stream({ ...options, maxTimeAllowed: options.maxTimeAllowed ?? timeoutMs }),
    );

  return requester;
}
