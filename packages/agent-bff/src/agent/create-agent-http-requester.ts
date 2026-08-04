import { HttpRequester } from '@forestadmin/agent-client';

type QueryOptions = Parameters<HttpRequester['query']>[0];

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
  requester.query = (<Data = unknown>(options: QueryOptions): Promise<Data> =>
    query({
      ...options,
      maxTimeAllowed: options.maxTimeAllowed ?? timeoutMs,
    })) as HttpRequester['query'];

  return requester;
}
