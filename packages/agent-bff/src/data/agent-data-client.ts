import { HttpRequester } from '@forestadmin/agent-client';

export interface AgentDataClientOptions {
  agentUrl: string;
  token: string;
}

export interface AgentDataClient {
  list(collection: string, query: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  countRaw(collection: string, query: Record<string, unknown>): Promise<unknown>;
  listRelation(
    collection: string,
    parentId: string,
    relation: string,
    query: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]>;
  countRelationRaw(
    collection: string,
    parentId: string,
    relation: string,
    query: Record<string, unknown>,
  ): Promise<unknown>;
}

/**
 * Thin data client bound to a request's agent token. Uses the raw `HttpRequester` (not `Collection`)
 * so the BFF controls the query params — notably the resolved `timezone` — and can read the count
 * endpoint's raw payload, which `collection.count()` coerces through `Number()` and loses.
 */
export default function createAgentDataClient({
  agentUrl,
  token,
}: AgentDataClientOptions): AgentDataClient {
  const requester = new HttpRequester(token, { url: agentUrl });

  // Segments are passed raw: HttpRequester.buildUrl already runs the whole path through
  // escapeUrlSlug/encodeURI, so pre-encoding here would double-encode (`|` -> `%257C`).
  const relationPath = (collection: string, parentId: string, relation: string) =>
    `/forest/${collection}/${parentId}/relationships/${relation}`;

  return {
    list: (collection, query) =>
      requester.query({ method: 'get', path: `/forest/${collection}`, query }),
    countRaw: (collection, query) =>
      requester.query({
        method: 'get',
        path: `/forest/${collection}/count`,
        query,
        skipDeserialization: true,
      }),
    listRelation: (collection, parentId, relation, query) =>
      requester.query({ method: 'get', path: relationPath(collection, parentId, relation), query }),
    countRelationRaw: (collection, parentId, relation, query) =>
      requester.query({
        method: 'get',
        path: `${relationPath(collection, parentId, relation)}/count`,
        query,
        skipDeserialization: true,
      }),
  };
}
