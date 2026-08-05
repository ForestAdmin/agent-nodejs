import { HttpRequester } from '@forestadmin/agent-client';

type QueryOptions = Parameters<HttpRequester['query']>[0];
type StreamOptions = Parameters<HttpRequester['stream']>[0];

export default function createAgentHttpRequester(
  token: string,
  agentUrl: string,
  timeoutMs?: number,
): HttpRequester {
  const requester = new HttpRequester(token, { url: agentUrl });

  if (timeoutMs === undefined) {
    return requester;
  }

  const query = requester.query.bind(requester);
  requester.query = <Data = unknown>(options: QueryOptions): Promise<Data> =>
    query({
      ...options,
      maxTimeAllowed: options.maxTimeAllowed ?? timeoutMs,
    });

  const stream = requester.stream.bind(requester);
  requester.stream = (options: StreamOptions): Promise<void> =>
    stream({
      ...options,
      maxTimeAllowed: options.maxTimeAllowed ?? timeoutMs,
    });

  return requester;
}
